import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	FACILITY_STATUS,
	USER_STATUS,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	HTTP_RESPONSE_CODE,
	type TransferResponse,
} from "@referral-tracking/shared";

import { generateUuid } from "../../lib/util";
import { canDecideTransfer, canRequestTransfer } from "../../lib/permission";

import { userCount, userOne } from "../../repository/user";
import { timelineCreate, timelineMany } from "../../repository/timeline";
import { patientOne, patientUpdate } from "../../repository/patient";
import { facilityOne } from "../../repository/facility";
import {
	type TransferRow,
	transferIsOpen,
	transferResolveRequest,
	transferGetLatestAction,
	transferGetPendingForFacility,
	transferGetLatestActionsByPatient,
	transferGetLatestRequestsByPatient,
} from "../../repository/cross-schema/transfer";

import type { Executor } from "../../repository/helpers";

import type {
	TransfersRequest,
	TransferApproveRequest,
	TransferRejectRequest,
	TransferRequestRequest,
} from "./type";

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

/** Hydrates a transfer episode into the richer `transferSchema` shape — `request` supplies the stable reason/requester/facility ids, `latest` supplies the current stage. */
const hydrateTransfer = async (
	database: Executor,
	{ request, latest }: { request: TransferRow; latest: TransferRow },
): Promise<TransferResponse["data"]> => {
	const [patient, originFacility, destinationFacility, requester] =
		await Promise.all([
			patientOne(database, {
				where: { id: request.entity },
				select: { id: true, first_name: true, last_name: true },
			}),
			facilityOne(database, {
				where: { id: request.previous! },
				select: { id: true, name: true },
			}),
			facilityOne(database, {
				where: { id: request.next! },
				select: { id: true, name: true },
			}),
			userOne(database, {
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
	};
};

/** Requests a patient transfer — Nurse/Doctor at the patient's current facility only, to an `APPROVED` destination, one open transfer per patient at a time. */
export const transferRequest = async (
	request: FastifyRequest<TransferRequestRequest>,
	reply: FastifyReply<TransferRequestRequest>,
): Promise<void> => {
	const database = request.server.database;

	const patient = await patientOne(database, {
		where: { id: request.params.id },
		select: { id: true, facility_id: true },
	});

	if (!patient) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Patient not found." });
	}

	const role = request.user!.role;
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

	const existing = await transferGetLatestAction(database, {
		patientId: patient.id,
	});
	if (existing && transferIsOpen(existing.action)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "A transfer request is already in progress for this patient.",
		});
	}

	const destination = await facilityOne(database, {
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

	const [row] = await timelineCreate(
		database,
		{ select: TRANSFER_ROW_FIELDS },
		{
			id: generateUuid(),
			type: TIMELINE_TYPE.PATIENT,
			entity: patient.id,
			action: TIMELINE_ACTION.TRANSFER_REQUESTED,
			previous: patient.facility_id,
			next: destinationId,
			changer_id: request.user!.id,
			notes: reason,
		},
	);

	const data = await hydrateTransfer(database, { request: row, latest: row });

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({ code, message: "Transfer requested.", data });
};

/** Shared decide logic for the four origin/destination approve/reject endpoints. */
const decideTransferSide = async (
	request: FastifyRequest<TransferApproveRequest | TransferRejectRequest>,
	reply: FastifyReply<TransferApproveRequest | TransferRejectRequest>,
	side: "origin" | "destination",
	approve: boolean,
): Promise<void> => {
	const database = request.server.database;

	const resolved = await transferResolveRequest(database, {
		requestId: request.params.id,
	});
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

	const role = request.user!.role;
	const isOrphaned =
		role === ROLES.ADMINISTRATOR
			? (await userCount(database, {
					where: {
						facility_id: facilityId,
						role: ROLES.MANAGER,
						status: USER_STATUS.ACTIVE,
					},
				})) === 0
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

	const newRow = await database.transaction(async (tx) => {
		if (side === "destination" && approve) {
			await patientUpdate(
				tx,
				{ where: { id: requestRow.entity }, select: { id: true } },
				{ facility_id: requestRow.next! },
			);
		}

		const [created] = await timelineCreate(
			tx,
			{ select: TRANSFER_ROW_FIELDS },
			{
				id: generateUuid(),
				type: TIMELINE_TYPE.PATIENT,
				entity: requestRow.entity,
				action,
				previous: requestRow.previous,
				next: requestRow.next,
				changer_id: request.user!.id,
				notes,
			},
		);

		return created;
	});

	const data = await hydrateTransfer(database, {
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

/** Approves a transfer's origin side. */
export const transferOriginApprove = (
	request: FastifyRequest<TransferApproveRequest>,
	reply: FastifyReply<TransferApproveRequest>,
): Promise<void> => decideTransferSide(request, reply, "origin", true);

/** Rejects a transfer's origin side. */
export const transferOriginReject = (
	request: FastifyRequest<TransferRejectRequest>,
	reply: FastifyReply<TransferRejectRequest>,
): Promise<void> => decideTransferSide(request, reply, "origin", false);

/** Approves a transfer's destination side, moving the patient's facility. */
export const transferDestinationApprove = (
	request: FastifyRequest<TransferApproveRequest>,
	reply: FastifyReply<TransferApproveRequest>,
): Promise<void> => decideTransferSide(request, reply, "destination", true);

/** Rejects a transfer's destination side. */
export const transferDestinationReject = (
	request: FastifyRequest<TransferRejectRequest>,
	reply: FastifyReply<TransferRejectRequest>,
): Promise<void> => decideTransferSide(request, reply, "destination", false);

/** Pending transfers awaiting this caller's decision — Manager sees their own facility, Administrator sees every currently-orphaned facility. */
export const transfers = async (
	request: FastifyRequest<TransfersRequest>,
	reply: FastifyReply<TransfersRequest>,
): Promise<void> => {
	const database = request.server.database;
	const role = request.user!.role;
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

	let current: TransferRow[];

	if (role === ROLES.MANAGER) {
		if (!userFacilityId) return empty();
		current = await transferGetPendingForFacility(database, {
			facilityId: userFacilityId,
		});
	} else {
		const rows = await timelineMany(database, {
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

		const latestByPatient = await transferGetLatestActionsByPatient(database, {
			patientIds: rows.data.map((row) => row.entity),
		});

		const candidates = rows.data.filter(
			(row) => latestByPatient.get(row.entity)?.id === row.id,
		);

		const orphaned = await Promise.all(
			candidates.map((row) => {
				const facilityId =
					row.action === TIMELINE_ACTION.TRANSFER_REQUESTED
						? row.previous!
						: row.next!;
				return userCount(database, {
					where: {
						facility_id: facilityId,
						role: ROLES.MANAGER,
						status: USER_STATUS.ACTIVE,
					},
				}).then((count) => count === 0);
			}),
		);
		current = candidates.filter((_, index) => orphaned[index]);
	}

	const total = current.length;
	const paged = current.slice((page - 1) * limit, (page - 1) * limit + limit);

	const requestsByPatient = await transferGetLatestRequestsByPatient(database, {
		patientIds: paged.map((row) => row.entity),
	});

	const data = await Promise.all(
		paged.map((row) =>
			hydrateTransfer(database, {
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
