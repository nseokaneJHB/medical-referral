import {
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	type TimelineAction,
} from "@referral-tracking/shared";

import { timelineOne, timelineMany } from "../timeline";

import type { Executor } from "../helpers";

import type { TimelineModelSelect } from "../../drizzle/schema";

const TRANSFER_ACTIONS: TimelineAction[] = [
	TIMELINE_ACTION.TRANSFER_REQUESTED,
	TIMELINE_ACTION.TRANSFER_APPROVED_ORIGIN,
	TIMELINE_ACTION.TRANSFER_APPROVED_DESTINATION,
	TIMELINE_ACTION.TRANSFER_REJECTED,
];

export type TransferRow = Pick<
	TimelineModelSelect,
	| "id"
	| "entity"
	| "action"
	| "previous"
	| "next"
	| "notes"
	| "changer_id"
	| "changed_at"
>;

const TRANSFER_ROW_FIELDS = {
	id: true,
	entity: true,
	action: true,
	previous: true,
	next: true,
	notes: true,
	changer_id: true,
	changed_at: true,
} as const;

type ResolvedTransferRequest = { request: TransferRow; latest: TransferRow };

/** The most recent transfer-related `timeline` row for a patient — its `action` alone tells you the stage, since a new request can't be created while one's already open. There's no dedicated `transfers` table; a transfer is a run of `type: PATIENT` timeline rows sharing no explicit parent-request foreign key, so the newest `TRANSFER_REQUESTED` row is always unambiguously the current episode's start. */
export const transferGetLatestAction = async (
	database: Executor,
	options: { patientId: string },
): Promise<TransferRow | null> => {
	const result = await timelineMany(database, {
		page: 1,
		limit: 1,
		where: {
			type: TIMELINE_TYPE.PATIENT,
			entity: options.patientId,
			action: { in: TRANSFER_ACTIONS },
		},
		order: { changed_at: "desc" },
		select: TRANSFER_ROW_FIELDS,
	});

	return result.data[0] ?? null;
};

/** `true` while a request is still awaiting either side's decision. */
export const transferIsOpen = (action: TimelineAction): boolean =>
	action === TIMELINE_ACTION.TRANSFER_REQUESTED ||
	action === TIMELINE_ACTION.TRANSFER_APPROVED_ORIGIN;

/** Batched `transferGetLatestAction` for a page of candidate patient ids — each candidate still needs confirming as its patient's *current* row, since a closed episode's earlier rows never disappear. */
export const transferGetLatestActionsByPatient = async (
	database: Executor,
	options: { patientIds: string[] },
): Promise<Map<string, TransferRow>> => {
	const latestByPatient = new Map<string, TransferRow>();
	if (options.patientIds.length === 0) return latestByPatient;

	const result = await timelineMany(database, {
		page: 1,
		limit: 1000,
		where: {
			type: TIMELINE_TYPE.PATIENT,
			entity: { in: options.patientIds },
			action: { in: TRANSFER_ACTIONS },
		},
		order: { changed_at: "desc" },
		select: TRANSFER_ROW_FIELDS,
	});

	for (const row of result.data) {
		if (latestByPatient.has(row.entity)) continue;
		latestByPatient.set(row.entity, row);
	}

	return latestByPatient;
};

/** Batched "most recent `TRANSFER_REQUESTED` row per patient" — hydrates `reason`/`requested_by`/facility ids for later rows in the same episode, since there's no parent-request foreign key back to the original request. */
export const transferGetLatestRequestsByPatient = async (
	database: Executor,
	options: { patientIds: string[] },
): Promise<Map<string, TransferRow>> => {
	const requestsByPatient = new Map<string, TransferRow>();
	if (options.patientIds.length === 0) return requestsByPatient;

	const result = await timelineMany(database, {
		page: 1,
		limit: 1000,
		where: {
			type: TIMELINE_TYPE.PATIENT,
			entity: { in: options.patientIds },
			action: TIMELINE_ACTION.TRANSFER_REQUESTED,
		},
		order: { changed_at: "desc" },
		select: TRANSFER_ROW_FIELDS,
	});

	for (const row of result.data) {
		if (requestsByPatient.has(row.entity)) continue;
		requestsByPatient.set(row.entity, row);
	}

	return requestsByPatient;
};

/** All currently-open transfer requests where `options.facilityId` needs to decide either side, filtered down to each candidate's still-current row so the Manager dashboard's pending count matches the pending-list endpoint. */
export const transferGetPendingForFacility = async (
	database: Executor,
	options: { facilityId: string },
): Promise<TransferRow[]> => {
	const rows = await timelineMany(database, {
		page: 1,
		limit: 1000,
		where: {
			type: TIMELINE_TYPE.PATIENT,
			OR: [
				{
					action: TIMELINE_ACTION.TRANSFER_REQUESTED,
					previous: options.facilityId,
				},
				{
					action: TIMELINE_ACTION.TRANSFER_APPROVED_ORIGIN,
					next: options.facilityId,
				},
			],
		},
		order: { changed_at: "desc" },
		select: TRANSFER_ROW_FIELDS,
	});

	const latestByPatient = await transferGetLatestActionsByPatient(database, {
		patientIds: rows.data.map((row) => row.entity),
	});

	return rows.data.filter(
		(row) => latestByPatient.get(row.entity)?.id === row.id,
	);
};

/** Resolves a transfer request by its stable id to that row plus the patient's current latest transfer action; returns `null` if the id doesn't identify a request, or identifies one superseded by a newer request for the same patient. */
export const transferResolveRequest = async (
	database: Executor,
	options: { requestId: string },
): Promise<ResolvedTransferRequest | null> => {
	const request = await timelineOne(database, {
		where: {
			id: options.requestId,
			type: TIMELINE_TYPE.PATIENT,
			action: TIMELINE_ACTION.TRANSFER_REQUESTED,
		},
		select: TRANSFER_ROW_FIELDS,
	});
	if (!request) return null;

	const mostRecentRequest = await timelineMany(database, {
		page: 1,
		limit: 1,
		where: {
			type: TIMELINE_TYPE.PATIENT,
			entity: request.entity,
			action: TIMELINE_ACTION.TRANSFER_REQUESTED,
		},
		order: { changed_at: "desc" },
		select: { id: true },
	});
	if (mostRecentRequest.data[0]?.id !== request.id) return null;

	const latest = await transferGetLatestAction(database, {
		patientId: request.entity,
	});
	if (!latest) return null;

	return { request, latest };
};
