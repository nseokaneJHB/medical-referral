import {
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	type TimelineAction,
} from "@referral-tracking/shared";

import type { CoreService } from "../core";

import type { TimelineModelSelect } from "../drizzle/schema";

type TransferCore = Pick<CoreService, "timeline">;

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

/**
 * Query/resolution logic for the two-sided patient facility-transfer
 * workflow (`docs/roles-permissions.md`, Row 1) — request, origin-approve,
 * destination-approve, both with a reject option at either step. Lives
 * here (composing `core.timeline`, no direct Drizzle) rather than
 * `modules/patients`, because the decision steps are exposed under both
 * `modules/manager` and `modules/administrator` (the latter as the
 * orphan-facility fallback), not just `patients`.
 *
 * There's no dedicated `transfers` table — a transfer is entirely a run of
 * rows in the shared `timeline` table (`type: PATIENT`), the same
 * append-only-log approach used for User/Facility moderation and Referral
 * status history. `TRANSFER_REQUESTED`'s own row is the stable identifier
 * for the whole request throughout its lifecycle: `previous`/`next` hold
 * the origin/destination facility ids chosen at request time, and every
 * later row for that episode (`TRANSFER_APPROVED_ORIGIN`, then either
 * `TRANSFER_APPROVED_DESTINATION` or `TRANSFER_REJECTED`) is a *new* row
 * with its own id — there's no explicit parent-request foreign key linking
 * them back. Only one transfer can ever be open for a given patient at a
 * time (enforced at request-creation), which is what makes "no explicit
 * link" safe: the most recent `TRANSFER_REQUESTED` row for a patient is
 * unambiguously the start of whatever episode (open or just-closed) is
 * current — a later, unrelated request literally cannot exist yet while an
 * earlier one is still open.
 *
 * NOTE: `getLatestActionsByPatient`/`getPendingForFacility` use the same
 * fetch-a-bounded-batch-then-filter-in-app-code approach `AppealManager`
 * used to, before that was reworked into a real DB-level `NOT EXISTS`
 * query (`Timeline.openAppeals`) for scalability. This hasn't been
 * reworked the same way — flagged here as the same class of tradeoff,
 * not fixed as part of this pass.
 */
export class TransferManager {
	private readonly core: TransferCore;

	constructor(core: TransferCore) {
		this.core = core;
	}

	/**
	 * The most recent transfer-related timeline row for a patient — the
	 * "current state" of their transfer workflow, or `null` if they've
	 * never had one (or their last one fully closed and the door's shut).
	 * Since a request can't be created while one's already open, this
	 * row's `action` alone tells you the stage: `TRANSFER_REQUESTED`
	 * (awaiting origin), `TRANSFER_APPROVED_ORIGIN` (awaiting
	 * destination), or a closed one (`TRANSFER_APPROVED_DESTINATION`/
	 * `TRANSFER_REJECTED`).
	 */
	getLatestAction = async (patientId: string): Promise<TransferRow | null> => {
		const result = await this.core.timeline.many({
			page: 1,
			limit: 1,
			where: {
				type: TIMELINE_TYPE.PATIENT,
				entity: patientId,
				action: { in: TRANSFER_ACTIONS },
			},
			order: { changed_at: "desc" },
			select: TRANSFER_ROW_FIELDS,
		});

		return result.data[0] ?? null;
	};

	/** `true` while a request is still awaiting either side's decision. */
	isOpen = (action: TimelineAction): boolean =>
		action === TIMELINE_ACTION.TRANSFER_REQUESTED ||
		action === TIMELINE_ACTION.TRANSFER_APPROVED_ORIGIN;

	/**
	 * Batched version of `getLatestAction` for a whole page of candidate
	 * patient ids at once — the pending-transfers list can't just filter
	 * `timeline` rows by action type, since a closed episode's
	 * `TRANSFER_REQUESTED`/`TRANSFER_APPROVED_ORIGIN` rows never disappear;
	 * each candidate has to be confirmed as still its patient's *current*
	 * row. `limit: 1000` mirrors `patients/service.ts`'s flag-status batch
	 * lookup — same "realistic volumes are nowhere near this" reasoning.
	 */
	getLatestActionsByPatient = async (
		patientIds: string[],
	): Promise<Map<string, TransferRow>> => {
		const latestByPatient = new Map<string, TransferRow>();
		if (patientIds.length === 0) return latestByPatient;

		const result = await this.core.timeline.many({
			page: 1,
			limit: 1000,
			where: {
				type: TIMELINE_TYPE.PATIENT,
				entity: { in: patientIds },
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

	/**
	 * Batched "most recent `TRANSFER_REQUESTED` row per patient" — the
	 * original request row for whatever episode (open or closed) is
	 * current. Needed to hydrate `reason`/`requested_by`/facility ids for
	 * rows further along than the request itself, since there's no
	 * parent-request foreign key linking a later decision row back to it
	 * (see class docstring).
	 */
	getLatestRequestsByPatient = async (
		patientIds: string[],
	): Promise<Map<string, TransferRow>> => {
		const requestsByPatient = new Map<string, TransferRow>();
		if (patientIds.length === 0) return requestsByPatient;

		const result = await this.core.timeline.many({
			page: 1,
			limit: 1000,
			where: {
				type: TIMELINE_TYPE.PATIENT,
				entity: { in: patientIds },
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

	/**
	 * All currently-open transfer requests where `facilityId` needs to
	 * decide either side (origin's `TRANSFER_REQUESTED` rows, or
	 * destination's `TRANSFER_APPROVED_ORIGIN` rows) — the same "confirm
	 * each candidate is still current" filtering the pending-transfers list
	 * endpoint needs, factored out so the Manager dashboard's
	 * pending-actions count can reuse it without duplicating the logic.
	 */
	getPendingForFacility = async (
		facilityId: string,
	): Promise<TransferRow[]> => {
		const rows = await this.core.timeline.many({
			page: 1,
			limit: 1000,
			where: {
				type: TIMELINE_TYPE.PATIENT,
				OR: [
					{ action: TIMELINE_ACTION.TRANSFER_REQUESTED, previous: facilityId },
					{
						action: TIMELINE_ACTION.TRANSFER_APPROVED_ORIGIN,
						next: facilityId,
					},
				],
			},
			order: { changed_at: "desc" },
			select: TRANSFER_ROW_FIELDS,
		});

		const latestByPatient = await this.getLatestActionsByPatient(
			rows.data.map((row) => row.entity),
		);

		return rows.data.filter(
			(row) => latestByPatient.get(row.entity)?.id === row.id,
		);
	};

	/**
	 * Resolves a transfer request by its stable id (the original
	 * `TRANSFER_REQUESTED` row) to that row plus the patient's *current*
	 * latest transfer action — which is either the request row itself
	 * (still awaiting an origin decision) or a later row from the same
	 * episode. Returns `null` if `requestId` doesn't identify a request at
	 * all, or identifies one that's been superseded by a newer request for
	 * the same patient (only possible once the older one fully closed) —
	 * callers should treat both cases as "not found," not try to
	 * distinguish them.
	 */
	resolveRequest = async (
		requestId: string,
	): Promise<ResolvedTransferRequest | null> => {
		const request = await this.core.timeline.one({
			where: {
				id: requestId,
				type: TIMELINE_TYPE.PATIENT,
				action: TIMELINE_ACTION.TRANSFER_REQUESTED,
			},
			select: TRANSFER_ROW_FIELDS,
		});
		if (!request) return null;

		const mostRecentRequest = await this.core.timeline.many({
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

		const latest = await this.getLatestAction(request.entity);
		if (!latest) return null;

		return { request, latest };
	};
}
