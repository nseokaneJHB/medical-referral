import {
	ROLES,
	USER_STATUS,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	REFERRAL_STATUS,
} from "@referral-tracking/shared";

import { generateUuid } from "../lib/util";

import type { CoreService } from "../core";

type AutoAssignmentCore = Pick<
	CoreService,
	"user" | "referral" | "specialty" | "timeline"
>;

/**
 * Non-terminal referral statuses — a doctor's "workload" for auto-assignment
 * purposes is their count of referrals in one of these. Kept local rather
 * than derived from `TERMINAL_REFERRAL_STATUSES` at runtime — same
 * hardcoded-list style as `TERMINAL_REFERRAL_STATUSES` itself
 * (`shared/src/constant.ts`).
 */
const NON_TERMINAL_REFERRAL_STATUSES: (typeof REFERRAL_STATUS)[keyof typeof REFERRAL_STATUS][] =
	[
		REFERRAL_STATUS.PENDING,
		REFERRAL_STATUS.ACCEPTED,
		REFERRAL_STATUS.IN_PROGRESS,
		REFERRAL_STATUS.ON_HOLD,
	];

/**
 * Doctor auto-assignment: workload-based, strictly same-facility, specialty-
 * matched. Full design/reasoning in `docs/auto-assignment.md`. Composes
 * `core.user`/`core.referral`/`core.specialty`/`core.timeline` (no direct
 * Drizzle access — that stays exclusive to `core/*.ts`), same layering as
 * `ModerationManager`/`AppealManager` in this directory.
 *
 * Bound to whatever `core`/executor it's constructed with. Construct with
 * `core.withTransaction(tx)`'s result to run inside a transaction; every
 * caller of this class treats it as best-effort (wrapped in its own
 * try/catch) rather than something whose failure should roll back the
 * action that triggered it — see callers for why.
 */
export class AutoAssignmentManager {
	private readonly core: AutoAssignmentCore;

	constructor(core: AutoAssignmentCore) {
		this.core = core;
	}

	/**
	 * Picks the least-loaded eligible Doctor at `facilityId` — `role: DOCTOR`,
	 * `status: ACTIVE`, and (when `specialtyIds` is non-empty) overlapping at
	 * least one of them via `user_specialties` — and returns their id, or
	 * `null` if none qualify. Ties broken by lowest `id` for determinism.
	 * Read-only; makes no DB writes.
	 */
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

	/**
	 * Finds and assigns the least-loaded eligible Doctor at `facilityId` to
	 * `referralId`, auto-accepting (mirrors every other doctor-assignment
	 * path) if `currentStatus` is `PENDING`. Writes a `DOCTOR_ASSIGNED`
	 * timeline row noting it was automatic. Returns `null` (no writes at
	 * all) if no eligible doctor exists — leaves the referral exactly as it
	 * was, same as today's ordinary "unassigned" state.
	 *
	 * Never throws for "no match" — only for a genuine DB error. Callers
	 * treat even that as best-effort (see class docstring).
	 */
	attempt = async (options: {
		referralId: string;
		facilityId: string;
		specialtyIds: string[];
		currentStatus: string;
	}): Promise<{ doctorId: string; doctorName: string | null } | null> => {
		const doctorId = await this.pickDoctor(
			options.facilityId,
			options.specialtyIds,
		);
		if (!doctorId) return null;

		const doctor = await this.core.user.one({
			where: { id: doctorId },
			select: { id: true, name: true },
		});
		if (!doctor) return null;

		const autoAccept = options.currentStatus === REFERRAL_STATUS.PENDING;

		await this.core.referral.update({
			where: { id: options.referralId },
			data: autoAccept
				? { doctor: doctor.id, status: REFERRAL_STATUS.ACCEPTED }
				: { doctor: doctor.id },
			select: { id: true },
		});

		// `changer_id` is a NOT NULL FK to a real person — there's no "system"
		// actor, so the assigned doctor themselves is recorded as the
		// changer; `notes` is what actually distinguishes this from every
		// other doctor-assignment path's timeline row.
		await this.core.timeline.create({
			data: {
				id: generateUuid(),
				type: TIMELINE_TYPE.REFERRAL,
				entity: options.referralId,
				action: TIMELINE_ACTION.DOCTOR_ASSIGNED,
				previous: options.currentStatus,
				next: autoAccept ? REFERRAL_STATUS.ACCEPTED : options.currentStatus,
				changer_id: doctor.id,
				notes: `Auto-assigned to ${doctor.name ?? "Unknown"} based on availability.`,
			},
			select: { id: true },
		});

		return { doctorId: doctor.id, doctorName: doctor.name };
	};

	/**
	 * Re-attempts auto-assignment for every unassigned, non-terminal referral
	 * destined for `facilityId` — call after something that could free up a
	 * matching doctor there (a referral there goes terminal, a doctor there
	 * is reactivated, a doctor there gains a specialty). Best-effort per
	 * referral; one failing doesn't stop the rest.
	 */
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

	/**
	 * Re-checks whether `referralId`'s currently assigned doctor still
	 * overlaps its current specialty set — call after a specialty tag is
	 * added to or removed from an already-assigned referral (the only two
	 * events that can change that set after assignment). No-op if the
	 * referral is unassigned, terminal, already past `ACCEPTED` (treatment
	 * has started — not silently reassigned out from under whoever's
	 * already handling it), or has no specialty tags at all (nothing to
	 * mismatch against). Otherwise, if the assigned doctor has zero overlap
	 * with the current tags, unassigns them (reverting an auto-accept back
	 * to `PENDING`), logs it, and immediately retries auto-assignment.
	 */
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
