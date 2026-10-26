import {
	TIMELINE_TYPE,
	type Role,
	type Timeline,
	type ManagerAudit,
} from "@referral-tracking/shared";

import { userMany } from "../user";
import { patientMany } from "../patient";
import { referralMany } from "../referral";
import { facilityMany } from "../facility";
import { timelineMany } from "../timeline";

import type { Executor, WhereClause, Pagination } from "../helpers";

import type { TimelineModelSelect } from "../../drizzle/schema";

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

/** Upper bound on staff/patient/referral ids a single facility can contribute when resolving which `timeline` rows belong to it — matches the cap the appeal/transfer queue resolution use elsewhere. */
const RELATED_ID_LIMIT = 1000;

type ListForFacilityOptions = {
	facilityId: string;
	page: number;
	limit: number;
};

/** Assembles a Manager's facility-wide activity feed: every `timeline` row about their staff, patients, referrals touching their facility, or the facility itself, merged into one paginated list — `timeline.entity` is polymorphic, so this resolves the facility's own id sets first, then filters by `(type, entity)` across all four at once. */
export const auditListForFacility = async (
	database: Executor,
	options: ListForFacilityOptions,
): Promise<Pagination<ManagerAudit>> => {
	const [staff, patients, referrals] = await Promise.all([
		userMany(database, {
			page: 1,
			limit: RELATED_ID_LIMIT,
			where: { facility_id: options.facilityId },
			select: { id: true },
		}),
		patientMany(database, {
			page: 1,
			limit: RELATED_ID_LIMIT,
			where: { facility_id: options.facilityId },
			select: { id: true },
		}),
		referralMany(database, {
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

	const result = await timelineMany(database, {
		where: { OR },
		order: { changed_at: "desc" },
		page: options.page,
		limit: options.limit,
		select: TIMELINE_FIELDS,
		include: TIMELINE_INCLUDE,
	});

	const data = await auditHydrateSubjects(database, {
		rows: result.data,
		viewerFacilityId: options.facilityId,
	});

	return {
		data,
		page: result.page,
		limit: result.limit,
		count: result.count,
		total: result.total,
	};
};

/** Batch-resolves the display `subject` (`{ id, name, role }`) and, for referrals, a facility-pair `reason` label for a page of `timeline` rows — one query per entity type, not one per row. `options.viewerFacilityId` renders as "Your facility" instead of the Manager's own facility name. */
export const auditHydrateSubjects = async (
	database: Executor,
	options: { rows: Timeline[]; viewerFacilityId: string },
): Promise<ManagerAudit[]> => {
	const { rows, viewerFacilityId } = options;

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
			? userMany(database, {
					page: 1,
					limit: userIds.length,
					where: { id: { in: userIds } },
					select: { id: true, name: true, role: true },
				})
			: null,
		referralIds.length > 0
			? referralMany(database, {
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

	const referralFacilityIds = (referrals?.data ?? []).flatMap((referral) => [
		referral.origin_facility_id,
		referral.destination_facility_id,
	]);

	const allFacilityIds = [...new Set([...facilityIds, ...referralFacilityIds])];

	const [patients, facilities] = await Promise.all([
		patientIds.length > 0
			? patientMany(database, {
					page: 1,
					limit: patientIds.length,
					where: { id: { in: patientIds } },
					select: { id: true, first_name: true, last_name: true },
				})
			: null,
		allFacilityIds.length > 0
			? facilityMany(database, {
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
