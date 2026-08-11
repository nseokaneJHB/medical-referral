import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	FACILITY_STATUS,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	HTTP_RESPONSE_CODE,
	type Role,
	type TransferResponse,
} from "@referral-tracking/shared";

import { generateUuid } from "../../lib/util";
import { canDecideTransfer, canRequestTransfer } from "../../lib/permission";
import { TransferManager, type TransferRow } from "../../management/transfer";

import type { CoreService } from "../../core";

import type {
	TransfersRequest,
	TransferApproveRequest,
	TransferRejectRequest,
	TransferRequestRequest,
} from "./transfer-type";

type TransferHydrationCore = Pick<CoreService, "patient" | "facility" | "user">;

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

/**
 * Hydrates a transfer episode into the richer `TransferSchema` shape.
 * `request` (the original `TRANSFER_REQUESTED` row) supplies the reason,
 * requester, and facility ids — stable for the episode's whole lifetime;
 * `latest` supplies the current stage (`action`/`changed_at`), which may be
 * a later row than `request` once a decision's been made. They're the same
 * row right after creation.
 */
const hydrateTransfer = async (
	core: TransferHydrationCore,
	{ request, latest }: { request: TransferRow; latest: TransferRow },
): Promise<TransferResponse["data"]> => {
	const [patient, originFacility, destinationFacility, requester] =
		await Promise.all([
			core.patient.one({
				where: { id: request.entity },
				select: { id: true, first_name: true, last_name: true },
			}),
			core.facility.one({
				where: { id: request.previous! },
				select: { id: true, name: true },
			}),
			core.facility.one({
				where: { id: request.next! },
				select: { id: true, name: true },
			}),
			core.user.one({
				where: { id: request.changer_id },
				select: { id: true, name: true },
			}),
		]);

	return {
		id: request.id,
		patient: patient!,
		origin_facility: originFacility!,
		destination_facility: destinationFacility!,
		reason: request.notes ?? "",
		action: latest.action,
		requested_by: requester!,
		changed_at: latest.changed_at,
	} as unknown as TransferResponse["data"];
};

/**
 * Nurse/Doctor at the patient's *current* facility only — replaces every
 * direct `facility_id` edit that used to exist (see
 * `docs/roles-permissions.md`, Row 1). Destination must be `APPROVED`
 * (same rule as a Doctor's referral redirect); only one transfer can be
 * open per patient at a time.
 */
export const transferRequest = async (
	request: FastifyRequest<TransferRequestRequest>,
	reply: FastifyReply<TransferRequestRequest>,
): Promise<void> => {
	const { core } = request.server;

	const patient = await core.patient.one({
		where: { id: request.params.id },
		select: { id: true, facility_id: true },
	});

	if (!patient) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const role = request.user!.role as Role;
	if (!canRequestTransfer(role, request.user!.facility_id, patient)) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"You may only request a transfer for a patient at your own facility.",
		});
	}

	const { destination_facility_id: destinationId, reason } = request.body;

	if (destinationId === patient.facility_id) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message:
				"The destination facility must be different from the patient's current facility.",
		});
	}

	const transferManager = new TransferManager(core);

	const existing = await transferManager.getLatestAction(patient.id);
	if (existing && transferManager.isOpen(existing.action)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "A transfer request is already in progress for this patient.",
		});
	}

	const destination = await core.facility.one({
		where: { id: destinationId },
		select: { id: true, status: true },
	});

	if (!destination || destination.status !== FACILITY_STATUS.APPROVED) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "The destination facility isn't currently available.",
		});
	}

	const [row] = await core.timeline.create({
		data: {
			id: generateUuid(),
			type: TIMELINE_TYPE.PATIENT,
			entity: patient.id,
			action: TIMELINE_ACTION.TRANSFER_REQUESTED,
			previous: patient.facility_id,
			next: destinationId,
			changer_id: request.user!.id,
			notes: reason,
		},
		select: TRANSFER_ROW_FIELDS,
	});

	const data = await hydrateTransfer(core, { request: row, latest: row });

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({ code, message: "Transfer requested.", data });
};

const decideTransferSide = async (
	request: FastifyRequest<TransferApproveRequest | TransferRejectRequest>,
	reply: FastifyReply<TransferApproveRequest | TransferRejectRequest>,
	side: "origin" | "destination",
	approve: boolean,
): Promise<void> => {
	const { core } = request.server;

	const resolved = await new TransferManager(core).resolveRequest(
		request.params.id,
	);
	if (!resolved) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply
			.status(status)
			.send({ code, message: "Transfer request not found." });
	}

	const { request: requestRow, latest } = resolved;

	const expectedStage =
		side === "origin"
			? TIMELINE_ACTION.TRANSFER_REQUESTED
			: TIMELINE_ACTION.TRANSFER_APPROVED_ORIGIN;

	if (latest.action !== expectedStage) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message:
				side === "origin"
					? "This request is no longer awaiting an origin decision."
					: "This request is no longer awaiting a destination decision.",
		});
	}

	const facilityId =
		side === "origin" ? requestRow.previous! : requestRow.next!;

	const role = request.user!.role as Role;
	const isOrphaned =
		role === ROLES.ADMINISTRATOR
			? await core.facility.isOrphaned(facilityId)
			: false;
	if (
		!canDecideTransfer(role, request.user!.facility_id, facilityId, isOrphaned)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message: `You may only decide the ${side} side of transfers for your own facility.`,
		});
	}

	const action = approve
		? side === "origin"
			? TIMELINE_ACTION.TRANSFER_APPROVED_ORIGIN
			: TIMELINE_ACTION.TRANSFER_APPROVED_DESTINATION
		: TIMELINE_ACTION.TRANSFER_REJECTED;

	const body = request.body as { notes?: string; reason?: string };
	const notes = approve ? (body.notes ?? null) : body.reason!;

	const newRow = await core.connection.transaction(async (tx) => {
		const txCore = core.withTransaction(tx);

		if (side === "destination" && approve) {
			await txCore.patient.update({
				where: { id: requestRow.entity },
				data: { facility_id: requestRow.next! },
				select: { id: true },
			});
		}

		const [created] = await txCore.timeline.create({
			data: {
				id: generateUuid(),
				type: TIMELINE_TYPE.PATIENT,
				entity: requestRow.entity,
				action,
				previous: requestRow.previous,
				next: requestRow.next,
				changer_id: request.user!.id,
				notes,
			},
			select: TRANSFER_ROW_FIELDS,
		});

		return created;
	});

	const data = await hydrateTransfer(core, {
		request: requestRow,
		latest: newRow,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: approve ? "Transfer approved." : "Transfer rejected.",
		data,
	});
};

export const transferOriginApprove = (
	request: FastifyRequest<TransferApproveRequest>,
	reply: FastifyReply<TransferApproveRequest>,
): Promise<void> => decideTransferSide(request, reply, "origin", true);

export const transferOriginReject = (
	request: FastifyRequest<TransferRejectRequest>,
	reply: FastifyReply<TransferRejectRequest>,
): Promise<void> => decideTransferSide(request, reply, "origin", false);

export const transferDestinationApprove = (
	request: FastifyRequest<TransferApproveRequest>,
	reply: FastifyReply<TransferApproveRequest>,
): Promise<void> => decideTransferSide(request, reply, "destination", true);

export const transferDestinationReject = (
	request: FastifyRequest<TransferRejectRequest>,
	reply: FastifyReply<TransferRejectRequest>,
): Promise<void> => decideTransferSide(request, reply, "destination", false);

/**
 * Pending transfers awaiting *this* caller's decision, either side.
 * Manager: scoped to their own facility. Administrator: every currently-
 * orphaned facility (no active Manager) — the same fallback used for
 * Nurse/Doctor account approvals, checked per-candidate here since there's
 * no cheap "all orphaned facilities" aggregate query at this ORM layer and
 * the candidate set is expected to be small.
 */
export const transfers = async (
	request: FastifyRequest<TransfersRequest>,
	reply: FastifyReply<TransfersRequest>,
): Promise<void> => {
	const { core } = request.server;
	const role = request.user!.role as Role;
	const userFacilityId = request.user!.facility_id;

	const page = request.query.page
		? Number(request.query.page)
		: DEFAULT_PAGE_NUMBER;
	const limit = request.query.limit
		? Number(request.query.limit)
		: DEFAULT_PAGE_LIMIT;

	const empty = () => {
		const { status, code } = HTTP_RESPONSE_CODE.OK;
		return reply.status(status).send({
			code,
			message: "Transfers retrieved.",
			data: [],
			page,
			limit,
			count: 0,
			total: 0,
		});
	};

	const transferManager = new TransferManager(core);

	let current: TransferRow[];

	if (role === ROLES.MANAGER) {
		if (!userFacilityId) return empty();
		current = await transferManager.getPendingForFacility(userFacilityId);
	} else {
		const rows = await core.timeline.many({
			page: 1,
			limit: 1000,
			where: {
				type: TIMELINE_TYPE.PATIENT,
				action: {
					in: [
						TIMELINE_ACTION.TRANSFER_REQUESTED,
						TIMELINE_ACTION.TRANSFER_APPROVED_ORIGIN,
					],
				},
			},
			order: { changed_at: "desc" },
			select: TRANSFER_ROW_FIELDS,
		});

		const latestByPatient = await transferManager.getLatestActionsByPatient(
			rows.data.map((row) => row.entity),
		);

		const candidates = rows.data.filter(
			(row) => latestByPatient.get(row.entity)?.id === row.id,
		);

		const orphaned = await Promise.all(
			candidates.map((row) => {
				const facilityId =
					row.action === TIMELINE_ACTION.TRANSFER_REQUESTED
						? row.previous!
						: row.next!;
				return core.facility.isOrphaned(facilityId);
			}),
		);
		current = candidates.filter((_, index) => orphaned[index]);
	}

	const total = current.length;
	const paged = current.slice((page - 1) * limit, (page - 1) * limit + limit);

	const requestsByPatient = await transferManager.getLatestRequestsByPatient(
		paged.map((row) => row.entity),
	);

	const data = await Promise.all(
		paged.map((row) =>
			hydrateTransfer(core, {
				request: requestsByPatient.get(row.entity)!,
				latest: row,
			}),
		),
	);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Transfers retrieved.",
		data,
		page,
		limit,
		count: data.length,
		total,
	});
};
