import {
	TIMELINE_TYPE,
	type UserStatus,
	type FacilityStatus,
	type TimelineAction,
} from "@referral-tracking/shared";

import { generateUuid } from "../lib/util";

import type { CoreService } from "../core";

import type { SelectClause } from "../core/helpers";

import type { UserModelSelect, FacilityModelSelect } from "../drizzle/schema";

type ModerationCore = Pick<CoreService, "user" | "facility" | "timeline">;

interface ApplyUserStatusChangeOptions<TSelect extends keyof UserModelSelect> {
	userId: string;
	status: UserStatus;
	action: TimelineAction;
	reason: string | null;
	changedBy: string;
	select: SelectClause<Pick<UserModelSelect, TSelect>>;
}

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

/**
 * "Update the entity's status, record why in the timeline" — used by both
 * `administrator` and `manager` services so that pattern isn't duplicated
 * across 8+ handlers. Composes `core.user`/`core.facility`/`core.timeline`
 * (no direct Drizzle access — that stays exclusive to `core/*.ts`), so it
 * lives here rather than in `lib/`, which must stay DB-free.
 *
 * Bound to whatever `core`/executor it's constructed with, same as every
 * `core/*.ts` repo class — construct with `core.withTransaction(tx)`'s
 * result to run inside a transaction (e.g. approving a Manager alongside
 * their paired-pending facility), the same pattern
 * `referrals/service.ts`'s `updateReferralStatus` uses for its own status
 * update + timeline write.
 */
export class ModerationManager {
	private readonly core: ModerationCore;

	constructor(core: ModerationCore) {
		this.core = core;
	}

	/**
	 * Does NOT validate the status-machine transition (e.g. "must be
	 * PENDING to approve") — that's action/route-specific and lives in the
	 * calling handler, not this generic primitive.
	 *
	 * @throws If `userId` doesn't exist.
	 */
	applyUserStatusChange = async <TSelect extends keyof UserModelSelect>(
		options: ApplyUserStatusChangeOptions<TSelect>,
	): Promise<Pick<UserModelSelect, TSelect>> => {
		const existing = await this.core.user.one({
			where: { id: options.userId },
			select: { status: true },
		});

		if (!existing) {
			throw new Error(
				`applyUserStatusChange: user ${options.userId} not found.`,
			);
		}

		const [updated] = await this.core.user.update({
			where: { id: options.userId },
			data: { status: options.status },
			select: options.select,
		});

		await this.core.timeline.create({
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

	/** Facility counterpart to `applyUserStatusChange` — same shape/contract. */
	applyFacilityStatusChange = async <TSelect extends keyof FacilityModelSelect>(
		options: ApplyFacilityStatusChangeOptions<TSelect>,
	): Promise<Pick<FacilityModelSelect, TSelect>> => {
		const existing = await this.core.facility.one({
			where: { id: options.facilityId },
			select: { status: true },
		});

		if (!existing) {
			throw new Error(
				`applyFacilityStatusChange: facility ${options.facilityId} not found.`,
			);
		}

		const [updated] = await this.core.facility.update({
			where: { id: options.facilityId },
			data: { status: options.status },
			select: options.select,
		});

		await this.core.timeline.create({
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
}
