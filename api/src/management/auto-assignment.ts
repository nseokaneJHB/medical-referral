import {
	ROLES,
	USER_STATUS,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	REFERRAL_STATUS,
	TERMINAL_REFERRAL_STATUSES,
} from "@referral-tracking/shared";

import { generateUuid } from "../lib/util";

import type { CoreService } from "../core";

type AutoAssignmentCore = Pick<
	CoreService,
	"user" | "referral" | "specialty" | "timeline"
>;

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

/** Full design in docs/auto-assignment.md; every caller treats this as best-effort, not something whose failure should roll back the triggering action. */
export class AutoAssignmentManager {
	private readonly core: AutoAssignmentCore;

	constructor(core: AutoAssignmentCore) {
		this.core = core;
	}

	/** Ties broken by lowest id for determinism. */
	private pickDoctor = async (
		facilityId: string,
		specialtyIds: string[],
	): Promise<string | null> => {
		let eligibleIds: string[] | null = null;

		if (specialtyIds.length > 0) {
			const links = await this.core.specialty.linkMany("user", {
				page: 1,
				limit: 1000,
				where: { specialty_id: { in: specialtyIds } },
				select: { user_id: true },
			});
			eligibleIds = [...new Set(links.data.map((link) => link.user_id))];
			if (eligibleIds.length === 0) return null;
		}

		const doctors = await this.core.user.many({
			page: 1,
			limit: 1000,
			where: {
				role: ROLES.DOCTOR,
				status: USER_STATUS.ACTIVE,
				facility_id: facilityId,
				...(eligibleIds ? { id: { in: eligibleIds } } : {}),
			},
			select: { id: true },
		});

		if (doctors.data.length === 0) return null;

		const workload = await this.core.referral.count(
			{
				doctor: { in: doctors.data.map((doctor) => doctor.id) },
				status: { in: NON_TERMINAL_REFERRAL_STATUSES },
			},
			"doctor",
		);

		const [best] = doctors.data
			.map((doctor) => ({ id: doctor.id, load: workload[doctor.id] ?? 0 }))
			.sort((a, b) => a.load - b.load || a.id.localeCompare(b.id));

		return best?.id ?? null;
	};

	/** Auto-accepts (mirrors every other doctor-assignment path) when currentStatus is PENDING; never throws for "no match", only for a genuine DB error. */
	attempt = async (payload: AttemptPayload): Promise<AssignedDoctor | null> => {
		const doctorId = await this.pickDoctor(
			payload.facilityId,
			payload.specialtyIds,
		);
		if (!doctorId) return null;

		const doctor = await this.core.user.one({
			where: { id: doctorId },
			select: { id: true, name: true },
		});
		if (!doctor) return null;

		const autoAccept = payload.currentStatus === REFERRAL_STATUS.PENDING;

		await this.core.referral.update({
			where: { id: payload.referralId },
			data: autoAccept
				? { doctor: doctor.id, status: REFERRAL_STATUS.ACCEPTED }
				: { doctor: doctor.id },
			select: { id: true },
		});

		/** changer_id is a NOT NULL FK to a real person; no "system" actor exists, so the assigned doctor is recorded as their own changer. */
		await this.core.timeline.create({
			data: {
				id: generateUuid(),
				type: TIMELINE_TYPE.REFERRAL,
				entity: payload.referralId,
				action: TIMELINE_ACTION.DOCTOR_ASSIGNED,
				previous: payload.currentStatus,
				next: autoAccept ? REFERRAL_STATUS.ACCEPTED : payload.currentStatus,
				changer_id: doctor.id,
				notes: `Auto-assigned to ${doctor.name ?? "Unknown"} based on availability.`,
			},
			select: { id: true },
		});

		return { doctorId: doctor.id, doctorName: doctor.name };
	};

	/** Best-effort per referral — one failing doesn't stop the rest. */
	recheckFacility = async (facilityId: string): Promise<void> => {
		const unassigned = await this.core.referral.many({
			page: 1,
			limit: 100,
			where: {
				destination_facility_id: facilityId,
				doctor: { isNull: true },
				status: { in: NON_TERMINAL_REFERRAL_STATUSES },
			},
			select: { id: true, status: true },
		});

		for (const referral of unassigned.data) {
			try {
				const specialtyLinks = await this.core.specialty.linkMany("referral", {
					page: 1,
					limit: 100,
					where: { referral_id: referral.id },
					select: { specialty_id: true },
				});

				await this.attempt({
					referralId: referral.id,
					facilityId,
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

	/** No-op once past ACCEPTED — treatment has started, so we don't silently reassign out from under whoever's already handling it. */
	revalidate = async (referralId: string): Promise<void> => {
		const referral = await this.core.referral.one({
			where: { id: referralId },
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

		const specialtyLinks = await this.core.specialty.linkMany("referral", {
			page: 1,
			limit: 100,
			where: { referral_id: referralId },
			select: { specialty_id: true },
		});
		const specialtyIds = specialtyLinks.data.map((link) => link.specialty_id);
		if (specialtyIds.length === 0) return;

		const overlap = await this.core.specialty.linkMany("user", {
			page: 1,
			limit: 1,
			where: { user_id: referral.doctor, specialty_id: { in: specialtyIds } },
			select: { id: true },
		});
		if (overlap.data.length > 0) return;

		const previousDoctorId = referral.doctor;

		await this.core.referral.update({
			where: { id: referralId },
			data: { doctor: null, status: REFERRAL_STATUS.PENDING },
			select: { id: true },
		});

		await this.core.timeline.create({
			data: {
				id: generateUuid(),
				type: TIMELINE_TYPE.REFERRAL,
				entity: referralId,
				action: TIMELINE_ACTION.DOCTOR_ASSIGNED,
				previous: referral.status,
				next: REFERRAL_STATUS.PENDING,
				changer_id: previousDoctorId,
				notes:
					"Unassigned automatically — the assigned doctor no longer matches this referral's required specialty.",
			},
			select: { id: true },
		});

		await this.attempt({
			referralId,
			facilityId: referral.destination_facility_id,
			specialtyIds,
			currentStatus: REFERRAL_STATUS.PENDING,
		});
	};
}
