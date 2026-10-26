import {
	TIMELINE_TYPE,
	type UserStatus,
	type FacilityStatus,
	type TimelineAction,
} from "@referral-tracking/shared";

import { generateUuid } from "../../lib/util";

import { userOne, userUpdate } from "../user";
import { timelineCreate } from "../timeline";
import { facilityOne, facilityUpdate } from "../facility";

import type { Executor, SelectClause } from "../helpers";

import type {
	UserModelSelect,
	FacilityModelSelect,
} from "../../drizzle/schema";

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

/** Updates a user's status and records why in the timeline, in one call — doesn't validate the status-machine transition itself, that's the caller's job. */
export const moderationApplyUserStatusChange = async <
	TSelect extends keyof UserModelSelect,
>(
	database: Executor,
	options: ApplyUserStatusChangeOptions<TSelect>,
): Promise<Pick<UserModelSelect, TSelect>> => {
	const existing = await userOne(database, {
		where: { id: options.userId },
		select: { status: true },
	});

	if (!existing) {
		throw new Error(
			`moderationApplyUserStatusChange: user ${options.userId} not found.`,
		);
	}

	const [updated] = await userUpdate(
		database,
		{ where: { id: options.userId }, select: options.select },
		{ status: options.status },
	);

	await timelineCreate(
		database,
		{ select: { id: true } },
		{
			id: generateUuid(),
			type: TIMELINE_TYPE.USER,
			entity: options.userId,
			action: options.action,
			previous: existing.status,
			next: options.status,
			changer_id: options.changedBy,
			notes: options.reason,
		},
	);

	return updated;
};

/** Facility counterpart to `moderationApplyUserStatusChange` — same shape/contract. */
export const moderationApplyFacilityStatusChange = async <
	TSelect extends keyof FacilityModelSelect,
>(
	database: Executor,
	options: ApplyFacilityStatusChangeOptions<TSelect>,
): Promise<Pick<FacilityModelSelect, TSelect>> => {
	const existing = await facilityOne(database, {
		where: { id: options.facilityId },
		select: { status: true },
	});

	if (!existing) {
		throw new Error(
			`moderationApplyFacilityStatusChange: facility ${options.facilityId} not found.`,
		);
	}

	const [updated] = await facilityUpdate(
		database,
		{ where: { id: options.facilityId }, select: options.select },
		{ status: options.status },
	);

	await timelineCreate(
		database,
		{ select: { id: true } },
		{
			id: generateUuid(),
			type: TIMELINE_TYPE.FACILITY,
			entity: options.facilityId,
			action: options.action,
			previous: existing.status,
			next: options.status,
			changer_id: options.changedBy,
			notes: options.reason,
		},
	);

	return updated;
};
