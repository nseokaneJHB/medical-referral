import {
	ROLES,
	USER_STATUS,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	FACILITY_STATUS,
	type Role,
	type Appeal,
	type Timeline,
	type TimelineType,
	type TimelineAction,
} from "@referral-tracking/shared";

import { generateUuid } from "../../lib/util";

import { userOne, userMany, userUpdate } from "../user";
import { timelineMany, timelineCreate } from "../timeline";
import { facilityOne, facilityMany, facilityUpdate } from "../facility";
import { autoAssignmentRecheckFacility } from "./auto-assignment";

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

/** Not `ReadonlyArray` — passed directly into a `WhereOperator.in`, which expects a plain mutable array. */
const PUNITIVE_TIMELINE_ACTIONS: TimelineAction[] = [
	TIMELINE_ACTION.REJECTED,
	TIMELINE_ACTION.DISABLED,
	TIMELINE_ACTION.FLAGGED,
	TIMELINE_ACTION.SUSPENDED,
];

/** The appeal-specific action set fed into `timelineMany`'s `supersededBy` — an `APPEAL_SUBMITTED` row stops being current once any of these happens later for the same entity. */
const APPEAL_ACTIONS: TimelineAction[] = [
	TIMELINE_ACTION.APPEAL_SUBMITTED,
	TIMELINE_ACTION.APPEAL_APPROVED,
	TIMELINE_ACTION.APPEAL_DENIED,
];

export interface AppealAuthority {
	userId: string;
	role: Role;
}

type ListOptions = {
	where?: WhereClause<TimelineModelSelect>;
	page: number;
	limit: number;
};

type DecidePayload = {
	type: TimelineType;
	entity: string;
	approve: boolean;
	notes: string;
	decidedBy: string;
};

type AppealRow = {
	id: string;
	type: TimelineType;
	entity: string;
};

type AppealEntityRef = {
	type: TimelineType;
	entity: string;
};

type AppealCountByType = { user: number; facility: number };

/** Paginated, still-open appeals matching `options.where` — real DB-level pagination via `timelineMany`'s `supersededBy`, not an app-level fetch-and-filter. Manager scopes `where` to their own facility's staff; Administrator passes nothing for the system-wide queue. */
export const appealList = async (
	database: Executor,
	options: ListOptions,
): Promise<Pagination<Appeal>> => {
	const result = await timelineMany(database, {
		where: { ...options.where, action: TIMELINE_ACTION.APPEAL_SUBMITTED },
		supersededBy: APPEAL_ACTIONS,
		order: { changed_at: "desc" },
		page: options.page,
		limit: options.limit,
		select: TIMELINE_FIELDS,
		include: TIMELINE_INCLUDE,
	});

	const data = await appealHydrateSubjects(database, { rows: result.data });

	return {
		data,
		page: result.page,
		limit: result.limit,
		count: result.count,
		total: result.total,
	};
};

/** Counts still-open `APPEAL_SUBMITTED` rows by entity type (USER vs FACILITY), for a "by type" breakdown stat — `options.where` should not include `type` (set per-branch here) and should mirror whatever scoping `appealList` already applies. */
export const appealCountByType = async (
	database: Executor,
	options?: { where?: WhereClause<TimelineModelSelect> },
): Promise<AppealCountByType> => {
	const [userResult, facilityResult] = await Promise.all([
		timelineMany(database, {
			where: {
				...options?.where,
				type: TIMELINE_TYPE.USER,
				action: TIMELINE_ACTION.APPEAL_SUBMITTED,
			},
			supersededBy: APPEAL_ACTIONS,
			page: 1,
			limit: 1,
			select: { id: true },
		}),
		timelineMany(database, {
			where: {
				...options?.where,
				type: TIMELINE_TYPE.FACILITY,
				action: TIMELINE_ACTION.APPEAL_SUBMITTED,
			},
			supersededBy: APPEAL_ACTIONS,
			page: 1,
			limit: 1,
			select: { id: true },
		}),
	]);

	return { user: userResult.total, facility: facilityResult.total };
};

/** `true` if `options` (an `APPEAL_SUBMITTED` row being decided) is still open — both decide endpoints must check this before calling `appealDecide`, since re-deciding by the original row's stable id would otherwise silently succeed twice. */
export const appealIsOpen = async (
	database: Executor,
	options: AppealRow,
): Promise<boolean> => {
	const result = await timelineMany(database, {
		where: {
			id: options.id,
			type: options.type,
			entity: options.entity,
			action: TIMELINE_ACTION.APPEAL_SUBMITTED,
		},
		supersededBy: APPEAL_ACTIONS,
		page: 1,
		limit: 1,
		select: { id: true },
	});

	return result.data.length > 0;
};

/** `true` if the entity already has an open `APPEAL_SUBMITTED` row — blocks a second appeal from being filed while one is pending, mirroring `transferIsOpen`'s "one open request at a time" rule. */
export const appealHasOpenAppeal = async (
	database: Executor,
	options: { type: TimelineType; entity: string },
): Promise<boolean> => {
	const result = await timelineMany(database, {
		where: {
			type: options.type,
			entity: options.entity,
			action: TIMELINE_ACTION.APPEAL_SUBMITTED,
		},
		supersededBy: APPEAL_ACTIONS,
		page: 1,
		limit: 1,
		select: { id: true },
	});

	return result.data.length > 0;
};

/** Decides an `APPEAL_SUBMITTED` row: approving flips the entity to its "good" terminal status regardless of which punitive status preceded it; denying leaves the status unchanged. Doesn't check whether `payload.decidedBy` is allowed to decide it, or that it's still open — that's the calling handler's job, before this runs. */
export const appealDecide = async (
	database: Executor,
	payload: DecidePayload,
): Promise<Pick<TimelineModelSelect, keyof typeof TIMELINE_FIELDS>> => {
	const isUser = payload.type === TIMELINE_TYPE.USER;

	const current = isUser
		? await userOne(database, {
				where: { id: payload.entity },
				select: { status: true, role: true, facility_id: true },
			})
		: await facilityOne(database, {
				where: { id: payload.entity },
				select: { status: true },
			});

	if (!current) {
		throw new Error(`appealDecide: ${payload.type} ${payload.entity} not found.`);
	}

	const goodStatus = isUser ? USER_STATUS.ACTIVE : FACILITY_STATUS.APPROVED;

	if (payload.approve) {
		if (isUser) {
			await userUpdate(
				database,
				{ where: { id: payload.entity }, select: { id: true } },
				{ status: USER_STATUS.ACTIVE },
			);
		} else {
			await facilityUpdate(
				database,
				{ where: { id: payload.entity }, select: { id: true } },
				{ status: FACILITY_STATUS.APPROVED },
			);
		}
	}

	const [entry] = await timelineCreate(
		database,
		{ select: TIMELINE_FIELDS },
		{
			id: generateUuid(),
			type: payload.type,
			entity: payload.entity,
			action: payload.approve
				? TIMELINE_ACTION.APPEAL_APPROVED
				: TIMELINE_ACTION.APPEAL_DENIED,
			previous: current.status,
			next: payload.approve ? goodStatus : current.status,
			changer_id: payload.decidedBy,
			notes: payload.notes,
		},
	);

	/** Best-effort — reinstating a Doctor must succeed regardless of a bug in the matching logic underneath. */
	if (
		payload.approve &&
		isUser &&
		"role" in current &&
		current.role === ROLES.DOCTOR &&
		current.facility_id
	) {
		try {
			await autoAssignmentRecheckFacility(database, {
				facilityId: current.facility_id,
			});
		} catch (error) {
			console.error(
				`Auto-assignment recheck failed after reinstating user ${payload.entity}:`,
				error,
			);
		}
	}

	return entry;
};

/** Batch-resolves the display `subject` (`{ id, name }`) for a page of `APPEAL_SUBMITTED` rows, whose bare `entity` UUID isn't enough on its own to render a usable queue — matches `appealRowSchema` in `shared/src/schema/timeline.ts`. */
export const appealHydrateSubjects = async (
	database: Executor,
	options: { rows: Timeline[] },
): Promise<Appeal[]> => {
	const { rows } = options;

	const userIds = rows
		.filter((row) => row.type === TIMELINE_TYPE.USER)
		.map((row) => row.entity);
	const facilityIds = rows
		.filter((row) => row.type === TIMELINE_TYPE.FACILITY)
		.map((row) => row.entity);

	const [users, facilities] = await Promise.all([
		userIds.length > 0
			? userMany(database, {
					page: 1,
					limit: userIds.length,
					where: { id: { in: userIds } },
					select: { id: true, name: true },
				})
			: null,
		facilityIds.length > 0
			? facilityMany(database, {
					page: 1,
					limit: facilityIds.length,
					where: { id: { in: facilityIds } },
					select: { id: true, name: true },
				})
			: null,
	]);

	const nameById = new Map<string, string | null>();
	for (const user of users?.data ?? []) nameById.set(user.id, user.name);
	for (const facility of facilities?.data ?? [])
		nameById.set(facility.id, facility.name);

	return rows.map((row) => ({
		...row,
		subject: { id: row.entity, name: nameById.get(row.entity) ?? null },
	}));
};

/** Resolves "who imposed the status this appeal is contesting" — the most recent punitive timeline row for this entity, and that actor's *current* role. Returns `null` if there's no punitive history to attribute. */
export const appealResolveAuthority = async (
	database: Executor,
	options: AppealEntityRef,
): Promise<AppealAuthority | null> => {
	const result = await timelineMany(database, {
		page: 1,
		limit: 1,
		where: {
			type: options.type,
			entity: options.entity,
			action: { in: PUNITIVE_TIMELINE_ACTIONS },
		},
		order: { changed_at: "desc" },
		select: { changer_id: true },
	});

	const [latest] = result.data;
	if (!latest) return null;

	const actor = await userOne(database, {
		where: { id: latest.changer_id },
		select: { id: true, role: true },
	});

	if (!actor) return null;

	return { userId: actor.id, role: actor.role };
};
