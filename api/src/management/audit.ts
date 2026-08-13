import {
	TIMELINE_TYPE,
	type Role,
	type Timeline,
	type ManagerAudit,
} from "@referral-tracking/shared";

import type { CoreService } from "../core";

import type { WhereClause, Pagination } from "../core/helpers";

import type { TimelineModelSelect } from "../drizzle/schema";

type AuditCore = Pick<
	CoreService,
	"timeline" | "user" | "patient" | "referral" | "facility"
>;

const TIMELINE_FIELDS = {
	id: true,
	type: true,
	entity: true,
	action: true,
	previous: true,
	next: true,
	notes: true,
	changed_at: true,
} as const;

const TIMELINE_INCLUDE = {
	changer: { select: { id: true, name: true } },
} as const;

/**
 * Upper bound on how many staff/patient/referral ids a single facility can
 * contribute when resolving which `timeline` rows belong to it — matches
 * the same pragmatic cap `AppealManager`'s staff resolution and
 * `TransferManager.getPendingForFacility` already use elsewhere.
 */
const RELATED_ID_LIMIT = 1000;

/**
 * Assembles a Manager's facility-wide activity feed: every `timeline` row
 * about their staff, their patients, referrals touching their facility
 * (either direction), or their facility itself, merged into one paginated
 * list. `timeline.entity` is polymorphic (no real FK — see `core/timeline.ts`),
 * so this resolves the facility's own id sets first, then filters `timeline`
 * by `(type, entity)` across all four at once. Lives here (not
 * `core/timeline.ts`) because it composes `user`/`patient`/`referral`/
 * `facility` lookups on top of the raw table — same shape as
 * `AppealManager`/`TransferManager`.
 */
export class AuditManager {
	private readonly core: AuditCore;

	constructor(core: AuditCore) {
		this.core = core;
	}

	listForFacility = async (options: {
		facilityId: string;
		page: number;
		limit: number;
	}): Promise<Pagination<ManagerAudit>> => {
		const [staff, patients, referrals] = await Promise.all([
			this.core.user.many({
				page: 1,
				limit: RELATED_ID_LIMIT,
				where: { facility_id: options.facilityId },
				select: { id: true },
			}),
			this.core.patient.many({
				page: 1,
				limit: RELATED_ID_LIMIT,
				where: { facility_id: options.facilityId },
				select: { id: true },
			}),
			this.core.referral.many({
				page: 1,
				limit: RELATED_ID_LIMIT,
				where: {
					OR: [
						{ origin_facility_id: options.facilityId },
						{ destination_facility_id: options.facilityId },
					],
				},
				select: { id: true },
			}),
		]);

		const staffIds = staff.data.map((row) => row.id);
		const patientIds = patients.data.map((row) => row.id);
		const referralIds = referrals.data.map((row) => row.id);

		const OR: WhereClause<TimelineModelSelect>[] = [
			{ type: TIMELINE_TYPE.FACILITY, entity: options.facilityId },
		];
		if (staffIds.length > 0) {
			OR.push({ type: TIMELINE_TYPE.USER, entity: { in: staffIds } });
		}
		if (patientIds.length > 0) {
			OR.push({ type: TIMELINE_TYPE.PATIENT, entity: { in: patientIds } });
		}
		if (referralIds.length > 0) {
			OR.push({ type: TIMELINE_TYPE.REFERRAL, entity: { in: referralIds } });
		}

		const result = await this.core.timeline.many({
			where: { OR },
			order: { changed_at: "desc" },
			page: options.page,
			limit: options.limit,
			select: TIMELINE_FIELDS,
			include: TIMELINE_INCLUDE,
		});

		// `changer` (via `include: TIMELINE_INCLUDE`) isn't modeled by
		// `Timeline.many()`'s return type — present at runtime, invisible to
		// this type. Same gap as `AppealManager.list`.
		const rows = result.data as unknown as Timeline[];
		const data = await this.hydrateSubjects(rows, options.facilityId);

		return {
			data,
			page: result.page,
			limit: result.limit,
			count: result.count,
			total: result.total,
		};
	};

	/**
	 * `entity` alone is a bare UUID — batch-fetches every distinct
	 * user/patient/facility name referenced by `rows` (one query per type,
	 * not one per row) and attaches it as `subject`, normalized to
	 * `{ id, name, role }` regardless of entity type: a patient's `name` is
	 * its first + last name joined; `role` is only ever populated for
	 * `type: USER` rows (Nurse/Doctor/Manager/Administrator), null
	 * everywhere else — the frontend uses it to disambiguate which kind of
	 * person a User-type row is about.
	 *
	 * A REFERRAL row's `subject.name` isn't the referral's own reason text —
	 * it's the two facilities it moves between ("{origin} → {destination}"),
	 * since a referral has no display name of its own. `viewerFacilityId`
	 * lets that read "Your facility" instead of the Manager's own facility's
	 * name, since it's always them reading it. Resolving a referral's
	 * facility names requires a second batch-fetch round (their ids aren't
	 * known until the referral rows themselves come back), so this runs in
	 * two sequential `Promise.all` phases rather than one.
	 */
	hydrateSubjects = async (
		rows: Timeline[],
		viewerFacilityId: string,
	): Promise<ManagerAudit[]> => {
		const userIds = rows
			.filter((row) => row.type === TIMELINE_TYPE.USER)
			.map((row) => row.entity);
		const patientIds = rows
			.filter((row) => row.type === TIMELINE_TYPE.PATIENT)
			.map((row) => row.entity);
		const referralIds = rows
			.filter((row) => row.type === TIMELINE_TYPE.REFERRAL)
			.map((row) => row.entity);
		const facilityIds = rows
			.filter((row) => row.type === TIMELINE_TYPE.FACILITY)
			.map((row) => row.entity);

		const [users, referrals] = await Promise.all([
			userIds.length > 0
				? this.core.user.many({
						page: 1,
						limit: userIds.length,
						where: { id: { in: userIds } },
						select: { id: true, name: true, role: true },
					})
				: null,
			referralIds.length > 0
				? this.core.referral.many({
						page: 1,
						limit: referralIds.length,
						where: { id: { in: referralIds } },
						select: {
							id: true,
							origin_facility_id: true,
							destination_facility_id: true,
							referral_reason: true,
						},
					})
				: null,
		]);

		const referralFacilityIds = (referrals?.data ?? []).flatMap(
			(referral) => [
				referral.origin_facility_id,
				referral.destination_facility_id,
			],
		);

		const allFacilityIds = [
			...new Set([...facilityIds, ...referralFacilityIds]),
		];

		const [patients, facilities] = await Promise.all([
			patientIds.length > 0
				? this.core.patient.many({
						page: 1,
						limit: patientIds.length,
						where: { id: { in: patientIds } },
						select: { id: true, first_name: true, last_name: true },
					})
				: null,
			allFacilityIds.length > 0
				? this.core.facility.many({
						page: 1,
						limit: allFacilityIds.length,
						where: { id: { in: allFacilityIds } },
						select: { id: true, name: true },
					})
				: null,
		]);

		const nameById = new Map<string, string | null>();
		const roleById = new Map<string, Role | null>();
		const reasonById = new Map<string, string | null>();
		for (const user of users?.data ?? []) {
			nameById.set(user.id, user.name);
			roleById.set(user.id, user.role);
		}
		for (const patient of patients?.data ?? [])
			nameById.set(
				patient.id,
				`${patient.first_name} ${patient.last_name}`.trim(),
			);
		for (const facility of facilities?.data ?? [])
			nameById.set(facility.id, facility.name);

		const facilityLabel = (facilityId: string): string =>
			facilityId === viewerFacilityId
				? "Your facility"
				: (nameById.get(facilityId) ?? "an unknown facility");

		for (const referral of referrals?.data ?? []) {
			nameById.set(
				referral.id,
				`${facilityLabel(referral.origin_facility_id)} → ${facilityLabel(referral.destination_facility_id)}`,
			);
			reasonById.set(referral.id, referral.referral_reason);
		}

		return rows.map((row) => ({
			...row,
			subject: {
				id: row.entity,
				name: nameById.get(row.entity) ?? null,
				role: roleById.get(row.entity) ?? null,
			},
			reason: reasonById.get(row.entity) ?? null,
		}));
	};
}
