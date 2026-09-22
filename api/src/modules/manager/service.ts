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
import {
	canFileFacilityAppeal,
	canManagerActOnStaff,
} from "../../lib/permission";

import { userOne, userMany } from "../../repository/user";
import { facilityOne } from "../../repository/facility";
import { timelineOne, timelineCreate } from "../../repository/timeline";
import {
	appealList,
	appealDecide,
	appealIsOpen,
	appealCountByType,
	appealHasOpenAppeal,
	appealResolveAuthority,
} from "../../repository/cross-schema/appeal";
import { auditListForFacility } from "../../repository/cross-schema/audit";
import {
	moderationApplyUserStatusChange,
} from "../../repository/cross-schema/moderation";

import type {
	AppealsRequest,
	StaffFlagRequest,
	AuditListRequest,
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

type StaffTarget = { id: string; role: string; status: string };

/** Shared staff-target lookup: 404s (not 403, non-enumerating) if the target isn't this Manager's own staff, and blocks a `FLAGGED` Manager from moderating staff at all. */
const resolveStaffTarget = async (
	request: FastifyRequest<{ Params: { id: string } }>,
	reply: FastifyReply,
): Promise<StaffTarget | null> => {
	if (request.user!.status === USER_STATUS.FLAGGED) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		reply.status(status).send({
			code,
			message:
				"Your account is flagged — you can't moderate staff right now. See GET /account/status.",
		});
		return null;
	}

	const target = await userOne(request.server.database, {
		where: { id: request.params.id },
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

/** Approves a pending staff application. */
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

	const updated = await moderationApplyUserStatusChange(request.server.database, {
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

/** Rejects a pending staff application. */
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

	const updated = await moderationApplyUserStatusChange(request.server.database, {
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

/** Disables an active or flagged staff member. */
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

	const updated = await moderationApplyUserStatusChange(request.server.database, {
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

/** Flags an active staff member for review. */
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

	const updated = await moderationApplyUserStatusChange(request.server.database, {
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

/** Files an appeal against the Manager's own facility's current status. */
export const facilityAppealSubmit = async (
	request: FastifyRequest<FacilityAppealSubmitRequest>,
	reply: FastifyReply<FacilityAppealSubmitRequest>,
): Promise<void> => {
	const manager = request.user!;
	const database = request.server.database;

	if (!manager.facility_id) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "You aren't attached to a facility." });
	}

	const facility = await facilityOne(database, {
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

	if (
		await appealHasOpenAppeal(database, {
			type: TIMELINE_TYPE.FACILITY,
			entity: facility.id,
		})
	) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message:
				"This facility already has a pending appeal — wait for it to be decided.",
		});
	}

	const [entry] = await timelineCreate(
		database,
		{ select: TIMELINE_FIELDS },
		{
			id: generateUuid(),
			type: TIMELINE_TYPE.FACILITY,
			entity: facility.id,
			action: TIMELINE_ACTION.APPEAL_SUBMITTED,
			previous: null,
			next: null,
			changer_id: manager.id,
			notes: request.body.reason,
		},
	);

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Appeal submitted.",
		data: { ...entry, changer: { id: manager.id, name: manager.name } },
	});
};

/** Shared decide logic for `appealApprove`/`appealDeny` — only lets a Manager decide an appeal for a status they personally imposed. */
const decideAppealAsManager = async (
	request: FastifyRequest<AppealApproveRequest>,
	reply: FastifyReply<AppealApproveRequest>,
	approve: boolean,
): Promise<void> => {
	const manager = request.user!;
	const database = request.server.database;

	if (manager.status !== USER_STATUS.ACTIVE) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply
			.status(status)
			.send({ code, message: "Your account isn't active." });
	}

	const appeal = await timelineOne(database, {
		where: { id: request.params.id },
		select: { id: true, type: true, entity: true, action: true },
	});

	if (!appeal || appeal.action !== TIMELINE_ACTION.APPEAL_SUBMITTED) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Appeal not found." });
	}

	if (!(await appealIsOpen(database, appeal))) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "This appeal has already been decided." });
	}

	const type =
		appeal.type as (typeof TIMELINE_TYPE)[keyof typeof TIMELINE_TYPE];

	const authority = await appealResolveAuthority(database, {
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

	const entry = await database.transaction(async (tx) =>
		appealDecide(tx, {
			type,
			entity: appeal.entity,
			approve,
			notes: request.body.notes,
			decidedBy: manager.id,
		}),
	);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: approve ? "Appeal approved." : "Appeal denied.",
		data: { ...entry, changer: { id: manager.id, name: manager.name } },
	});
};

/** Approves an appeal the Manager personally imposed the status for. */
export const appealApprove = (
	request: FastifyRequest<AppealApproveRequest>,
	reply: FastifyReply<AppealApproveRequest>,
): Promise<void> => decideAppealAsManager(request, reply, true);

/** Denies an appeal the Manager personally imposed the status for. */
export const appealDeny = (
	request: FastifyRequest<AppealDenyRequest>,
	reply: FastifyReply<AppealDenyRequest>,
): Promise<void> => decideAppealAsManager(request, reply, false);

/** Lists open appeals scoped to this Manager's own staff — only `USER`-type appeals for their facility's Nurse/Doctor, unlike Administrator's system-wide queue. */
export const appeals = async (
	request: FastifyRequest<AppealsRequest>,
	reply: FastifyReply<AppealsRequest>,
): Promise<void> => {
	const manager = request.user!;
	const database = request.server.database;
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
			by_type: { user: 0, facility: 0 },
		});
	}

	const staff = await userMany(database, {
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
			by_type: { user: 0, facility: 0 },
		});
	}

	const appealWhere = { type: TIMELINE_TYPE.USER, entity: { in: staffIds } };

	const result = await appealList(database, {
		where: appealWhere,
		page,
		limit,
	});
	const by_type = await appealCountByType(database, { where: appealWhere });

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Appeals retrieved.",
		...result,
		by_type,
	});
};

/** A Manager's facility-wide activity feed — see `auditListForFacility` for how the facility-scoping works. */
export const auditList = async (
	request: FastifyRequest<AuditListRequest>,
	reply: FastifyReply<AuditListRequest>,
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
			message: "Facility audit retrieved.",
			data: [],
			page,
			limit,
			count: 0,
			total: 0,
		});
	}

	const result = await auditListForFacility(request.server.database, {
		facilityId: manager.facility_id,
		page,
		limit,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Facility audit retrieved.",
		...result,
	});
};
