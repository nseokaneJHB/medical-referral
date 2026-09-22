import {
	ROLES,
	USER_STATUS,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	REFERRAL_STATUS,
	TERMINAL_REFERRAL_STATUSES,
} from "@referral-tracking/shared";

import { generateUuid } from "../../lib/util";

import { userOne, userMany } from "../user";
import { timelineCreate } from "../timeline";
import { specialtyLinkMany } from "../specialty";
import { referralOne, referralMany, referralCount, referralUpdate } from "../referral";

import type { Executor } from "../helpers";

type AttemptPayload = {
	referralId: string;
	facilityId: string;
	specialtyIds: string[];
	currentStatus: string;
};

type AssignedDoctor = {
	doctorId: string;
	doctorName: string | null;
};

const NON_TERMINAL_REFERRAL_STATUSES = Object.values(REFERRAL_STATUS).filter(
	(status) => !(TERMINAL_REFERRAL_STATUSES as string[]).includes(status),
);

/** Picks the least-loaded eligible active doctor at a facility, optionally restricted to a specialty set; ties break by lowest id for determinism. Full design in `docs/auto-assignment.md`. */
const pickDoctor = async (
	database: Executor,
	options: { facilityId: string; specialtyIds: string[] },
): Promise<string | null> => {
	let eligibleIds: string[] | null = null;

	if (options.specialtyIds.length > 0) {
		const links = await specialtyLinkMany(database, {
			owner: "user",
			page: 1,
			limit: 1000,
			where: { specialty_id: { in: options.specialtyIds } },
			select: { user_id: true },
		});
		eligibleIds = [...new Set(links.data.map((link) => link.user_id))];
		if (eligibleIds.length === 0) return null;
	}

	const doctors = await userMany(database, {
		page: 1,
		limit: 1000,
		where: {
			role: ROLES.DOCTOR,
			status: USER_STATUS.ACTIVE,
			facility_id: options.facilityId,
			...(eligibleIds ? { id: { in: eligibleIds } } : {}),
		},
		select: { id: true },
	});

	if (doctors.data.length === 0) return null;

	const workload = await referralCount(database, {
		where: {
			doctor: { in: doctors.data.map((doctor) => doctor.id) },
			status: { in: NON_TERMINAL_REFERRAL_STATUSES },
		},
		groupBy: "doctor",
	});

	const [best] = doctors.data
		.map((doctor) => ({ id: doctor.id, load: workload[doctor.id] ?? 0 }))
		.sort((a, b) => a.load - b.load || a.id.localeCompare(b.id));

	return best?.id ?? null;
};

/** Assigns the best-available doctor to a referral, auto-accepting when `payload.currentStatus` is PENDING; never throws for "no match," only for a genuine DB error. */
export const autoAssignmentAttempt = async (
	database: Executor,
	payload: AttemptPayload,
): Promise<AssignedDoctor | null> => {
	const doctorId = await pickDoctor(database, {
		facilityId: payload.facilityId,
		specialtyIds: payload.specialtyIds,
	});
	if (!doctorId) return null;

	const doctor = await userOne(database, {
		where: { id: doctorId },
		select: { id: true, name: true },
	});
	if (!doctor) return null;

	const autoAccept = payload.currentStatus === REFERRAL_STATUS.PENDING;

	await referralUpdate(
		database,
		{ where: { id: payload.referralId }, select: { id: true } },
		autoAccept
			? { doctor: doctor.id, status: REFERRAL_STATUS.ACCEPTED }
			: { doctor: doctor.id },
	);

	/** `changer_id` is a NOT NULL FK to a real person; no "system" actor exists, so the assigned doctor is recorded as their own changer. */
	await timelineCreate(
		database,
		{ select: { id: true } },
		{
			id: generateUuid(),
			type: TIMELINE_TYPE.REFERRAL,
			entity: payload.referralId,
			action: TIMELINE_ACTION.DOCTOR_ASSIGNED,
			previous: payload.currentStatus,
			next: autoAccept ? REFERRAL_STATUS.ACCEPTED : payload.currentStatus,
			changer_id: doctor.id,
			notes: `Auto-assigned to ${doctor.name ?? "Unknown"} based on availability.`,
		},
	);

	return { doctorId: doctor.id, doctorName: doctor.name };
};

/** Re-attempts assignment for every unassigned non-terminal referral at a facility — best-effort per referral, one failing doesn't stop the rest. */
export const autoAssignmentRecheckFacility = async (
	database: Executor,
	options: { facilityId: string },
): Promise<void> => {
	const unassigned = await referralMany(database, {
		page: 1,
		limit: 100,
		where: {
			destination_facility_id: options.facilityId,
			doctor: { isNull: true },
			status: { in: NON_TERMINAL_REFERRAL_STATUSES },
		},
		select: { id: true, status: true },
	});

	for (const referral of unassigned.data) {
		try {
			const specialtyLinks = await specialtyLinkMany(database, {
				owner: "referral",
				page: 1,
				limit: 100,
				where: { referral_id: referral.id },
				select: { specialty_id: true },
			});

			await autoAssignmentAttempt(database, {
				referralId: referral.id,
				facilityId: options.facilityId,
				specialtyIds: specialtyLinks.data.map((link) => link.specialty_id),
				currentStatus: referral.status,
			});
		} catch (error) {
			console.error(
				`Auto-assignment recheck failed for referral ${referral.id}:`,
				error,
			);
		}
	}
};

/** Unassigns a referral's doctor and re-attempts assignment if their specialty no longer overlaps the referral's required ones; no-op once past ACCEPTED, since treatment has started. */
export const autoAssignmentRevalidate = async (
	database: Executor,
	options: { referralId: string },
): Promise<void> => {
	const referral = await referralOne(database, {
		where: { id: options.referralId },
		select: {
			id: true,
			doctor: true,
			status: true,
			destination_facility_id: true,
		},
	});

	if (
		!referral ||
		!referral.doctor ||
		(referral.status !== REFERRAL_STATUS.PENDING &&
			referral.status !== REFERRAL_STATUS.ACCEPTED)
	) {
		return;
	}

	const specialtyLinks = await specialtyLinkMany(database, {
		owner: "referral",
		page: 1,
		limit: 100,
		where: { referral_id: options.referralId },
		select: { specialty_id: true },
	});
	const specialtyIds = specialtyLinks.data.map((link) => link.specialty_id);
	if (specialtyIds.length === 0) return;

	const overlap = await specialtyLinkMany(database, {
		owner: "user",
		page: 1,
		limit: 1,
		where: { user_id: referral.doctor, specialty_id: { in: specialtyIds } },
		select: { id: true },
	});
	if (overlap.data.length > 0) return;

	const previousDoctorId = referral.doctor;

	await referralUpdate(
		database,
		{ where: { id: options.referralId }, select: { id: true } },
		{ doctor: null, status: REFERRAL_STATUS.PENDING },
	);

	await timelineCreate(
		database,
		{ select: { id: true } },
		{
			id: generateUuid(),
			type: TIMELINE_TYPE.REFERRAL,
			entity: options.referralId,
			action: TIMELINE_ACTION.DOCTOR_ASSIGNED,
			previous: referral.status,
			next: REFERRAL_STATUS.PENDING,
			changer_id: previousDoctorId,
			notes:
				"Unassigned automatically — the assigned doctor no longer matches this referral's required specialty.",
		},
	);

	await autoAssignmentAttempt(database, {
		referralId: options.referralId,
		facilityId: referral.destination_facility_id,
		specialtyIds,
		currentStatus: REFERRAL_STATUS.PENDING,
	});
};
