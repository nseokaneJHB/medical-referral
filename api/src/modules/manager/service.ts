import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	USER_STATUS,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	HTTP_RESPONSE_CODE,
} from "@referral-tracking/shared";

import { generateUuid } from "../../lib/util";
import { decideAppeal, applyUserStatusChange } from "../../lib/moderation";
import {
	canFileFacilityAppeal,
	canManagerActOnStaff,
	resolveAppealAuthority,
} from "../../lib/permission";

import type {
	AppealsRequest,
	StaffFlagRequest,
	AppealDenyRequest,
	StaffApproveRequest,
	StaffRejectRequest,
	AppealApproveRequest,
	StaffDisableRequest,
	FacilityAppealSubmitRequest,
} from "./type";

const USER_FIELDS = {
	id: true,
	name: true,
	email: true,
	role: true,
	status: true,
	facility_id: true,
	created_at: true,
	updated_at: true,
} as const;

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
 * Shared staff-target lookup + the two guards every staff action needs:
 * the target must actually be this Manager's own staff (`canManagerActOnStaff`,
 * 404 rather than 403 if not — non-enumerating, matches `canAccessPatient`'s
 * pattern), and — the one FLAG carve-out this pass actually enforces — a
 * `FLAGGED` Manager can't moderate staff at all (see
 * `lib/permission.ts`'s `isAccountUsable` docstring for why this lives
 * here instead of the general middleware gate).
 */
const resolveStaffTarget = async <TRoute extends { Params: { id: string } }>(
	request: FastifyRequest<TRoute>,
	reply: FastifyReply,
): Promise<{ id: string; role: string; status: string } | null> => {
	if (request.user!.status === USER_STATUS.FLAGGED) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		reply.status(status).send({
			code,
			message:
				"Your account is flagged — you can't moderate staff right now. See GET /account/status.",
		});
		return null;
	}

	const params = request.params as { id: string };

	const target = await request.server.core.user.one({
		where: { id: params.id },
		select: { id: true, role: true, status: true, facility_id: true },
	});

	if (
		!target ||
		!(target.role === ROLES.NURSE || target.role === ROLES.DOCTOR) ||
		!canManagerActOnStaff(request.user!, target)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		reply.status(status).send({ code, message: "Staff member not found." });
		return null;
	}

	return target;
};

export const staffApprove = async (
	request: FastifyRequest<StaffApproveRequest>,
	reply: FastifyReply<StaffApproveRequest>,
): Promise<void> => {
	const target = await resolveStaffTarget(request, reply);
	if (!target) return;

	if (target.status !== USER_STATUS.PENDING) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "Only a pending application can be approved." });
	}

	const updated = await applyUserStatusChange(request.server.core, {
		userId: target.id,
		status: USER_STATUS.ACTIVE,
		action: TIMELINE_ACTION.APPROVED,
		reason: request.body.notes ?? null,
		changedBy: request.user!.id,
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Staff approved.", data: updated });
};

export const staffReject = async (
	request: FastifyRequest<StaffRejectRequest>,
	reply: FastifyReply<StaffRejectRequest>,
): Promise<void> => {
	const target = await resolveStaffTarget(request, reply);
	if (!target) return;

	if (target.status !== USER_STATUS.PENDING) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "Only a pending application can be rejected." });
	}

	const updated = await applyUserStatusChange(request.server.core, {
		userId: target.id,
		status: USER_STATUS.REJECTED,
		action: TIMELINE_ACTION.REJECTED,
		reason: request.body.reason,
		changedBy: request.user!.id,
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Staff rejected.", data: updated });
};

export const staffDisable = async (
	request: FastifyRequest<StaffDisableRequest>,
	reply: FastifyReply<StaffDisableRequest>,
): Promise<void> => {
	const target = await resolveStaffTarget(request, reply);
	if (!target) return;

	if (
		!(
			target.status === USER_STATUS.ACTIVE ||
			target.status === USER_STATUS.FLAGGED
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "Only an active or flagged staff member can be disabled.",
		});
	}

	const updated = await applyUserStatusChange(request.server.core, {
		userId: target.id,
		status: USER_STATUS.DISABLED,
		action: TIMELINE_ACTION.DISABLED,
		reason: request.body.reason,
		changedBy: request.user!.id,
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Staff disabled.", data: updated });
};

export const staffFlag = async (
	request: FastifyRequest<StaffFlagRequest>,
	reply: FastifyReply<StaffFlagRequest>,
): Promise<void> => {
	const target = await resolveStaffTarget(request, reply);
	if (!target) return;

	if (target.status !== USER_STATUS.ACTIVE) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "Only an active staff member can be flagged." });
	}

	const updated = await applyUserStatusChange(request.server.core, {
		userId: target.id,
		status: USER_STATUS.FLAGGED,
		action: TIMELINE_ACTION.FLAGGED,
		reason: request.body.reason,
		changedBy: request.user!.id,
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({ code, message: "Staff flagged.", data: updated });
};

export const facilityAppealSubmit = async (
	request: FastifyRequest<FacilityAppealSubmitRequest>,
	reply: FastifyReply<FacilityAppealSubmitRequest>,
): Promise<void> => {
	const manager = request.user!;

	if (!manager.facility_id) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "You aren't attached to a facility." });
	}

	const facility = await request.server.core.facility.one({
		where: { id: manager.facility_id },
		select: { id: true, status: true },
	});

	if (!facility || !canFileFacilityAppeal(manager, facility)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "There's nothing to appeal for your facility right now.",
		});
	}

	const [entry] = await request.server.core.timeline.create({
		data: {
			id: generateUuid(),
			type: TIMELINE_TYPE.FACILITY,
			entity: facility.id,
			action: TIMELINE_ACTION.APPEAL_SUBMITTED,
			previous: null,
			next: null,
			changer_id: manager.id,
			notes: request.body.reason,
		},
		select: TIMELINE_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Appeal submitted.",
		data: { ...entry, changer: { id: manager.id, name: manager.name } },
	});
};

const decideAppealAsManager = async (
	request: FastifyRequest<AppealApproveRequest>,
	reply: FastifyReply<AppealApproveRequest>,
	approve: boolean,
): Promise<void> => {
	const manager = request.user!;

	if (manager.status !== USER_STATUS.ACTIVE) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply
			.status(status)
			.send({ code, message: "Your account isn't active." });
	}

	const appeal = await request.server.core.timeline.one({
		where: { id: request.params.id },
		select: { id: true, type: true, entity: true, action: true },
	});

	if (!appeal || appeal.action !== TIMELINE_ACTION.APPEAL_SUBMITTED) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Appeal not found." });
	}

	const type =
		appeal.type as (typeof TIMELINE_TYPE)[keyof typeof TIMELINE_TYPE];

	const authority = await resolveAppealAuthority(request.server.core, {
		type,
		entity: appeal.entity,
	});

	if (!authority || authority.userId !== manager.id) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"You may only decide appeals you personally imposed the status for.",
		});
	}

	const entry = await request.server.core.connection.transaction(async (tx) => {
		const txCore = request.server.core.withTransaction(tx);

		return decideAppeal(txCore, {
			type,
			entity: appeal.entity,
			approve,
			notes: request.body.notes,
			decidedBy: manager.id,
		});
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: approve ? "Appeal approved." : "Appeal denied.",
		data: { ...entry, changer: { id: manager.id, name: manager.name } },
	});
};

export const appealApprove = (
	request: FastifyRequest<AppealApproveRequest>,
	reply: FastifyReply<AppealApproveRequest>,
): Promise<void> => decideAppealAsManager(request, reply, true);

export const appealDeny = (
	request: FastifyRequest<AppealDenyRequest>,
	reply: FastifyReply<AppealDenyRequest>,
): Promise<void> => decideAppealAsManager(request, reply, false);

/**
 * Scoped to this Manager's own staff — a Manager never legitimately
 * decides a Facility appeal (only Administrator ever imposes a facility's
 * punitive status), so unlike Administrator's system-wide queue, this only
 * looks at `USER`-type appeals for Nurse/Doctor at the Manager's facility.
 */
export const appeals = async (
	request: FastifyRequest<AppealsRequest>,
	reply: FastifyReply<AppealsRequest>,
): Promise<void> => {
	const manager = request.user!;
	const page = request.query.page
		? Number(request.query.page)
		: DEFAULT_PAGE_NUMBER;
	const limit = request.query.limit
		? Number(request.query.limit)
		: DEFAULT_PAGE_LIMIT;

	if (!manager.facility_id) {
		const { status, code } = HTTP_RESPONSE_CODE.OK;
		return reply.status(status).send({
			code,
			message: "Appeals retrieved.",
			data: [],
			page,
			limit,
			count: 0,
			total: 0,
		});
	}

	const staff = await request.server.core.user.many({
		page: 1,
		limit: 1000,
		where: {
			facility_id: manager.facility_id,
			role: { in: [ROLES.NURSE, ROLES.DOCTOR] },
		},
		select: { id: true },
	});

	const staffIds = staff.data.map((row) => row.id);

	if (staffIds.length === 0) {
		const { status, code } = HTTP_RESPONSE_CODE.OK;
		return reply.status(status).send({
			code,
			message: "Appeals retrieved.",
			data: [],
			page,
			limit,
			count: 0,
			total: 0,
		});
	}

	const result = await request.server.core.timeline.many({
		page,
		limit,
		where: {
			type: TIMELINE_TYPE.USER,
			action: TIMELINE_ACTION.APPEAL_SUBMITTED,
			entity: { in: staffIds },
		},
		order: { changed_at: "desc" },
		select: TIMELINE_FIELDS,
		include: TIMELINE_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Appeals retrieved.",
		...result,
	});
};
