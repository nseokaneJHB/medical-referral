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

import { generateUuid } from "../lib/util";

import { AutoAssignmentManager } from "./auto-assignment";

import type { CoreService } from "../core";

import type { WhereClause, Pagination } from "../core/helpers";

import type { TimelineModelSelect } from "../drizzle/schema";

type AppealCore = Pick<
	CoreService,
	"timeline" | "user" | "facility" | "referral" | "specialty"
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
 * Not `ReadonlyArray` — passed directly into a `WhereOperator.in`, which
 * expects a plain mutable array type.
 */
const PUNITIVE_TIMELINE_ACTIONS: TimelineAction[] = [
	TIMELINE_ACTION.REJECTED,
	TIMELINE_ACTION.DISABLED,
	TIMELINE_ACTION.FLAGGED,
	TIMELINE_ACTION.SUSPENDED,
];

/**
 * The appeal-specific parameters fed into `core.timeline.notSuperseded` —
 * an `APPEAL_SUBMITTED` row stops being "current" once any of these three
 * actions happens later for the same entity (a fresh submission, or a
 * decision).
 */
const APPEAL_ACTIONS: TimelineAction[] = [
	TIMELINE_ACTION.APPEAL_SUBMITTED,
	TIMELINE_ACTION.APPEAL_APPROVED,
	TIMELINE_ACTION.APPEAL_DENIED,
];

export interface AppealAuthority {
	userId: string;
	role: Role;
}

/**
 * Everything the appeals workflow needs beyond plain CRUD — composes
 * `core.timeline`/`core.user`/`core.facility` (no direct Drizzle access,
 * that's `core/timeline.ts`'s `openAppeals` alone). Lives here rather than
 * `lib/`, which must stay DB-free.
 */
export class AppealManager {
	private readonly core: AppealCore;

	constructor(core: AppealCore) {
		this.core = core;
	}

	/**
	 * Paginated, still-open appeals matching `where` — real DB-level
	 * pagination via `core.timeline.many`'s `supersededBy` (see its
	 * docstring), not an app-level fetch-and-filter. `where` lets Manager
	 * scope this to their own facility's staff (`{ type: TIMELINE_TYPE.USER,
	 * entity: { in: staffIds } }`); Administrator passes nothing for the
	 * system-wide queue.
	 */
	list = async (options: {
		where?: WhereClause<TimelineModelSelect>;
		page: number;
		limit: number;
	}): Promise<Pagination<Appeal>> => {
		const result = await this.core.timeline.many({
			where: { ...options.where, action: TIMELINE_ACTION.APPEAL_SUBMITTED },
			supersededBy: APPEAL_ACTIONS,
			order: { changed_at: "desc" },
			page: options.page,
			limit: options.limit,
			select: TIMELINE_FIELDS,
			include: TIMELINE_INCLUDE,
		});

		// `changer` (via `include: TIMELINE_INCLUDE`) isn't modeled by
		// `Timeline.many()`'s return type — present at runtime, just
		// invisible to this type. Same gap as `UserDetailResponse["data"]`
		// in `users/service.ts`.
		const rows = result.data as unknown as Timeline[];
		const data = await this.hydrateSubjects(rows);

		return {
			data,
			page: result.page,
			limit: result.limit,
			count: result.count,
			total: result.total,
		};
	};

	/**
	 * Counts still-open `APPEAL_SUBMITTED` rows by entity type (USER vs
	 * FACILITY), respecting the same `where`/`supersededBy` scoping as
	 * `list` — used to power a "by type" breakdown stat, not the paginated
	 * queue itself. `where` should NOT include `type` (this method sets it
	 * per-branch) — pass whatever scoping the caller already applies to
	 * `list` (e.g. a Manager's own-staff `entity: { in: staffIds }`).
	 */
	countByType = async (
		where?: WhereClause<TimelineModelSelect>,
	): Promise<{ user: number; facility: number }> => {
		const [userResult, facilityResult] = await Promise.all([
			this.core.timeline.many({
				where: {
					...where,
					type: TIMELINE_TYPE.USER,
					action: TIMELINE_ACTION.APPEAL_SUBMITTED,
				},
				supersededBy: APPEAL_ACTIONS,
				page: 1,
				limit: 1,
				select: { id: true },
			}),
			this.core.timeline.many({
				where: {
					...where,
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

	/**
	 * `true` if `row` (an `APPEAL_SUBMITTED` row being decided) is still
	 * open — i.e. hasn't already been approved/denied by an earlier
	 * decision. Both decide endpoints (`appealApprove`/`appealDeny`,
	 * Administrator and Manager) must check this before calling `decide`,
	 * since re-deciding by the original row's stable id would otherwise
	 * silently succeed a second time.
	 */
	isOpen = async (row: {
		id: string;
		type: TimelineType;
		entity: string;
	}): Promise<boolean> => {
		const result = await this.core.timeline.many({
			where: {
				id: row.id,
				type: row.type,
				entity: row.entity,
				action: TIMELINE_ACTION.APPEAL_SUBMITTED,
			},
			supersededBy: APPEAL_ACTIONS,
			page: 1,
			limit: 1,
			select: { id: true },
		});

		return result.data.length > 0;
	};

	/**
	 * `true` if `entity` already has an open (not yet superseded)
	 * `APPEAL_SUBMITTED` row — used to block a second appeal from being
	 * filed while one is still pending, mirroring
	 * `TransferManager.isOpen`'s "one open request at a time" rule.
	 */
	hasOpenAppeal = async (
		type: TimelineType,
		entity: string,
	): Promise<boolean> => {
		const result = await this.core.timeline.many({
			where: { type, entity, action: TIMELINE_ACTION.APPEAL_SUBMITTED },
			supersededBy: APPEAL_ACTIONS,
			page: 1,
			limit: 1,
			select: { id: true },
		});

		return result.data.length > 0;
	};

	/**
	 * Decides an `APPEAL_SUBMITTED` row: approving flips the entity's status
	 * to its "good" terminal state (`ACTIVE` for a User, `APPROVED` for a
	 * Facility) regardless of which punitive status preceded it; denying
	 * leaves the status untouched (the timeline row records `previous`/
	 * `next` as the same, unchanged value, for audit clarity — nothing
	 * changed).
	 *
	 * Deliberately does NOT check whether `decidedBy` is *allowed* to
	 * decide this appeal, nor that it's still open — those differ between
	 * callers (Administrator can decide any open appeal; a Manager only
	 * ones they personally imposed, per `resolveAuthority`) and belong in
	 * the calling handler, before this runs.
	 *
	 * @throws If the entity no longer exists.
	 */
	decide = async (options: {
		type: TimelineType;
		entity: string;
		approve: boolean;
		notes: string;
		decidedBy: string;
	}): Promise<Pick<TimelineModelSelect, keyof typeof TIMELINE_FIELDS>> => {
		const isUser = options.type === TIMELINE_TYPE.USER;

		const current = isUser
			? await this.core.user.one({
					where: { id: options.entity },
					select: { status: true, role: true, facility_id: true },
				})
			: await this.core.facility.one({
					where: { id: options.entity },
					select: { status: true },
				});

		if (!current) {
			throw new Error(`decide: ${options.type} ${options.entity} not found.`);
		}

		const goodStatus = isUser ? USER_STATUS.ACTIVE : FACILITY_STATUS.APPROVED;

		if (options.approve) {
			if (isUser) {
				await this.core.user.update({
					where: { id: options.entity },
					data: { status: USER_STATUS.ACTIVE },
					select: { id: true },
				});
			} else {
				await this.core.facility.update({
					where: { id: options.entity },
					data: { status: FACILITY_STATUS.APPROVED },
					select: { id: true },
				});
			}
		}

		const [entry] = await this.core.timeline.create({
			data: {
				id: generateUuid(),
				type: options.type,
				entity: options.entity,
				action: options.approve
					? TIMELINE_ACTION.APPEAL_APPROVED
					: TIMELINE_ACTION.APPEAL_DENIED,
				previous: current.status,
				next: options.approve ? goodStatus : current.status,
				changer_id: options.decidedBy,
				notes: options.notes,
			},
			select: TIMELINE_FIELDS,
		});

		/** Best-effort — reinstating a Doctor must succeed regardless of a bug in the matching logic underneath. */
		if (
			options.approve &&
			isUser &&
			"role" in current &&
			current.role === ROLES.DOCTOR &&
			current.facility_id
		) {
			try {
				await new AutoAssignmentManager(this.core).recheckFacility(
					current.facility_id,
				);
			} catch (error) {
				console.error(
					`Auto-assignment recheck failed after reinstating user ${options.entity}:`,
					error,
				);
			}
		}

		return entry;
	};

	/**
	 * An `APPEAL_SUBMITTED` timeline row's `entity` is a bare UUID — a user
	 * id or a facility id depending on `type` — not enough on its own to
	 * render a usable appeals queue. Batch-fetches every distinct
	 * user/facility name referenced by `rows` (one query per type, not one
	 * per row) and attaches it as `subject`, matching `AppealSchema` in
	 * `shared/src/schema/timeline.ts`.
	 */
	hydrateSubjects = async (rows: Timeline[]): Promise<Appeal[]> => {
		const userIds = rows
			.filter((row) => row.type === TIMELINE_TYPE.USER)
			.map((row) => row.entity);
		const facilityIds = rows
			.filter((row) => row.type === TIMELINE_TYPE.FACILITY)
			.map((row) => row.entity);

		const [users, facilities] = await Promise.all([
			userIds.length > 0
				? this.core.user.many({
						page: 1,
						limit: userIds.length,
						where: { id: { in: userIds } },
						select: { id: true, name: true },
					})
				: null,
			facilityIds.length > 0
				? this.core.facility.many({
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

	/**
	 * Resolves "who imposed the status this appeal is contesting" — the
	 * most recent punitive (`REJECTED`/`DISABLED`/`FLAGGED`/`SUSPENDED`)
	 * timeline row for this entity, and that actor's *current* role (not
	 * the role they held at the time — if they've since changed roles,
	 * today's role is what governs whether they can still decide it).
	 * Returns `null` if there's no punitive history to attribute (shouldn't
	 * happen for a real appeal, but callers must handle it rather than
	 * assume).
	 */
	resolveAuthority = async (target: {
		type: TimelineType;
		entity: string;
	}): Promise<AppealAuthority | null> => {
		const result = await this.core.timeline.many({
			page: 1,
			limit: 1,
			where: {
				type: target.type,
				entity: target.entity,
				action: { in: PUNITIVE_TIMELINE_ACTIONS },
			},
			order: { changed_at: "desc" },
			select: { changer_id: true },
		});

		const [latest] = result.data;
		if (!latest) return null;

		const actor = await this.core.user.one({
			where: { id: latest.changer_id },
			select: { id: true, role: true },
		});

		if (!actor) return null;

		return { userId: actor.id, role: actor.role as Role };
	};
}
