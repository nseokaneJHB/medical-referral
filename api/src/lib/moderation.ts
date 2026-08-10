import {
	USER_STATUS,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	FACILITY_STATUS,
	type UserStatus,
	type TimelineType,
	type FacilityStatus,
	type TimelineAction,
} from "@referral-tracking/shared";

import { generateUuid } from "./util";

import type { CoreService } from "../core";

import type { SelectClause } from "../core/helpers";

import type {
	UserModelSelect,
	TimelineModelSelect,
	FacilityModelSelect,
} from "../drizzle/schema";

/**
 * Shared transactional write helpers — "update the entity's status, record
 * why in the timeline" — used by both `administrator` and `manager`
 * services so that pattern isn't duplicated across 8+ handlers.
 *
 * Neither function opens its own transaction: they run whatever `core`/
 * executor they're handed, so the calling handler decides atomicity —
 * always wrap the call (and any paired call, e.g. approving a Manager
 * alongside their paired-pending facility) in
 * `core.connection.transaction(async (tx) => { const txCore =
 * core.withTransaction(tx); ... })`, the same pattern
 * `referrals/service.ts`'s `updateReferralStatus` already uses for its own
 * status update + timeline write.
 */

type ModerationCore = Pick<CoreService, "user" | "facility" | "timeline">;

interface ApplyUserStatusChangeOptions<TSelect extends keyof UserModelSelect> {
	userId: string;
	status: UserStatus;
	action: TimelineAction;
	reason: string | null;
	changedBy: string;
	select: SelectClause<Pick<UserModelSelect, TSelect>>;
}

/**
 * Updates a User's `status` and writes the matching `timeline` row in one
 * call. Does NOT validate the status-machine transition (e.g. "must be
 * PENDING to approve") — that's action/route-specific and lives in the
 * calling handler, not this generic primitive.
 *
 * @throws If `userId` doesn't exist.
 */
export const applyUserStatusChange = async <
	TSelect extends keyof UserModelSelect,
>(
	core: ModerationCore,
	options: ApplyUserStatusChangeOptions<TSelect>,
): Promise<Pick<UserModelSelect, TSelect>> => {
	const existing = await core.user.one({
		where: { id: options.userId },
		select: { status: true },
	});

	if (!existing) {
		throw new Error(`applyUserStatusChange: user ${options.userId} not found.`);
	}

	const [updated] = await core.user.update({
		where: { id: options.userId },
		data: { status: options.status },
		select: options.select,
	});

	await core.timeline.create({
		data: {
			id: generateUuid(),
			type: TIMELINE_TYPE.USER,
			entity: options.userId,
			action: options.action,
			previous: existing.status,
			next: options.status,
			changer_id: options.changedBy,
			notes: options.reason,
		},
		select: { id: true },
	});

	return updated;
};

interface ApplyFacilityStatusChangeOptions<
	TSelect extends keyof FacilityModelSelect,
> {
	facilityId: string;
	status: FacilityStatus;
	action: TimelineAction;
	reason: string | null;
	changedBy: string;
	select: SelectClause<Pick<FacilityModelSelect, TSelect>>;
}

/** Facility counterpart to `applyUserStatusChange` — same shape/contract. */
export const applyFacilityStatusChange = async <
	TSelect extends keyof FacilityModelSelect,
>(
	core: ModerationCore,
	options: ApplyFacilityStatusChangeOptions<TSelect>,
): Promise<Pick<FacilityModelSelect, TSelect>> => {
	const existing = await core.facility.one({
		where: { id: options.facilityId },
		select: { status: true },
	});

	if (!existing) {
		throw new Error(
			`applyFacilityStatusChange: facility ${options.facilityId} not found.`,
		);
	}

	const [updated] = await core.facility.update({
		where: { id: options.facilityId },
		data: { status: options.status },
		select: options.select,
	});

	await core.timeline.create({
		data: {
			id: generateUuid(),
			type: TIMELINE_TYPE.FACILITY,
			entity: options.facilityId,
			action: options.action,
			previous: existing.status,
			next: options.status,
			changer_id: options.changedBy,
			notes: options.reason,
		},
		select: { id: true },
	});

	return updated;
};

const TIMELINE_ENTRY_FIELDS = {
	id: true,
	type: true,
	entity: true,
	action: true,
	previous: true,
	next: true,
	changer_id: true,
	notes: true,
	changed_at: true,
} as const;

/**
 * Decides an `APPEAL_SUBMITTED` row: approving flips the entity's status
 * to its "good" terminal state (`ACTIVE` for a User, `APPROVED` for a
 * Facility) regardless of which punitive status preceded it; denying
 * leaves the status untouched (the timeline row records `previous`/`next`
 * as the same, unchanged value, for audit clarity — nothing changed).
 *
 * Deliberately does NOT check whether `decidedBy` is *allowed* to decide
 * this appeal — that authorization differs between callers (Administrator
 * can decide any appeal; a Manager only ones they personally imposed, per
 * `lib/permission.ts`'s `resolveAppealAuthority`) and belongs in each
 * module's own handler, before this runs.
 *
 * @throws If the entity no longer exists.
 */
export const decideAppeal = async (
	core: ModerationCore,
	options: {
		type: TimelineType;
		entity: string;
		approve: boolean;
		notes: string;
		decidedBy: string;
	},
): Promise<Pick<TimelineModelSelect, keyof typeof TIMELINE_ENTRY_FIELDS>> => {
	const isUser = options.type === TIMELINE_TYPE.USER;

	const current = isUser
		? await core.user.one({
				where: { id: options.entity },
				select: { status: true },
			})
		: await core.facility.one({
				where: { id: options.entity },
				select: { status: true },
			});

	if (!current) {
		throw new Error(
			`decideAppeal: ${options.type} ${options.entity} not found.`,
		);
	}

	const goodStatus = isUser ? USER_STATUS.ACTIVE : FACILITY_STATUS.APPROVED;

	if (options.approve) {
		if (isUser) {
			await core.user.update({
				where: { id: options.entity },
				data: { status: USER_STATUS.ACTIVE },
				select: { id: true },
			});
		} else {
			await core.facility.update({
				where: { id: options.entity },
				data: { status: FACILITY_STATUS.APPROVED },
				select: { id: true },
			});
		}
	}

	const [entry] = await core.timeline.create({
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
		select: TIMELINE_ENTRY_FIELDS,
	});

	return entry;
};
