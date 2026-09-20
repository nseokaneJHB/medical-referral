import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	USER_STATUS,
	FACILITY_STATUS,
	TIMELINE_ACTION,
	HTTP_RESPONSE_CODE,
	type TimelineType,
} from "@referral-tracking/shared";

import { auth } from "../../lib/auth";
import { hashPassword } from "../../lib/password";
import { generateTemporaryPassword } from "../../lib/util";
import { parsePagination } from "../../lib/validator";
import { AppealManager } from "../../management/appeal";
import { ModerationManager } from "../../management/moderation";

import type {
	AppealsRequest,
	StaffFlagRequest,
	UserCreateRequest,
	AppealDenyRequest,
	ManagerFlagRequest,
	StaffRejectRequest,
	StaffApproveRequest,
	AppealApproveRequest,
	FacilityFlagRequest,
	ManagerApproveRequest,
	StaffDisableRequest,
	ManagerDisableRequest,
	FacilityRejectRequest,
	ManagerRejectRequest,
	FacilityApproveRequest,
	FacilitySuspendRequest,
	UserResetPasswordRequest,
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

const FACILITY_FIELDS = {
	id: true,
	name: true,
	address: true,
	status: true,
	created_at: true,
	updated_at: true,
} as const;

/**
 * Approving a Manager whose registration included a new facility approves
 * that facility too, in the same transaction — they were paired `PENDING`
 * together, they resolve together.
 */
export const managerApprove = async (
	request: FastifyRequest<ManagerApproveRequest>,
	reply: FastifyReply<ManagerApproveRequest>,
): Promise<void> => {
	const target = await request.server.core.user.one({
		where: { id: request.params.id },
		select: { id: true, role: true, status: true, facility_id: true },
	});

	if (!target || target.role !== ROLES.MANAGER) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply
			.status(status)
			.send({ code, message: "Manager application not found." });
	}
	if (target.status !== USER_STATUS.PENDING) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "Only a pending Manager application can be approved.",
		});
	}

	await request.server.core.connection.transaction(async (tx) => {
		const txCore = request.server.core.withTransaction(tx);

		await new ModerationManager(txCore).applyUserStatusChange({
			userId: target.id,
			status: USER_STATUS.ACTIVE,
			action: TIMELINE_ACTION.APPROVED,
			reason: request.body.notes ?? null,
			changedBy: request.user!.id,
			select: { id: true },
		});

		if (target.facility_id) {
			const facility = await txCore.facility.one({
				where: { id: target.facility_id },
				select: { status: true },
			});

			if (facility?.status === FACILITY_STATUS.PENDING) {
				await new ModerationManager(txCore).applyFacilityStatusChange({
					facilityId: target.facility_id,
					status: FACILITY_STATUS.APPROVED,
					action: TIMELINE_ACTION.APPROVED,
					reason: request.body.notes ?? null,
					changedBy: request.user!.id,
					select: { id: true },
				});
			}
		}
	});

	const updated = await request.server.core.user.one({
		where: { id: target.id },
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Manager approved.", data: updated! });
};

export const managerReject = async (
	request: FastifyRequest<ManagerRejectRequest>,
	reply: FastifyReply<ManagerRejectRequest>,
): Promise<void> => {
	const target = await request.server.core.user.one({
		where: { id: request.params.id },
		select: { id: true, role: true, status: true, facility_id: true },
	});

	if (!target || target.role !== ROLES.MANAGER) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply
			.status(status)
			.send({ code, message: "Manager application not found." });
	}
	if (target.status !== USER_STATUS.PENDING) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "Only a pending Manager application can be rejected.",
		});
	}

	await request.server.core.connection.transaction(async (tx) => {
		const txCore = request.server.core.withTransaction(tx);

		await new ModerationManager(txCore).applyUserStatusChange({
			userId: target.id,
			status: USER_STATUS.REJECTED,
			action: TIMELINE_ACTION.REJECTED,
			reason: request.body.reason,
			changedBy: request.user!.id,
			select: { id: true },
		});

		if (target.facility_id) {
			const facility = await txCore.facility.one({
				where: { id: target.facility_id },
				select: { status: true },
			});

			if (facility?.status === FACILITY_STATUS.PENDING) {
				await new ModerationManager(txCore).applyFacilityStatusChange({
					facilityId: target.facility_id,
					status: FACILITY_STATUS.REJECTED,
					action: TIMELINE_ACTION.REJECTED,
					reason: request.body.reason,
					changedBy: request.user!.id,
					select: { id: true },
				});
			}
		}
	});

	const updated = await request.server.core.user.one({
		where: { id: target.id },
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Manager rejected.", data: updated! });
};

export const managerDisable = async (
	request: FastifyRequest<ManagerDisableRequest>,
	reply: FastifyReply<ManagerDisableRequest>,
): Promise<void> => {
	const target = await request.server.core.user.one({
		where: { id: request.params.id },
		select: { id: true, role: true, status: true },
	});

	if (!target || target.role !== ROLES.MANAGER) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Manager not found." });
	}
	if (
		!(
			target.status === USER_STATUS.ACTIVE ||
			target.status === USER_STATUS.FLAGGED
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "Only an active or flagged Manager can be disabled.",
		});
	}

	const updated = await new ModerationManager(
		request.server.core,
	).applyUserStatusChange({
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
		.send({ code, message: "Manager disabled.", data: updated });
};

export const managerFlag = async (
	request: FastifyRequest<ManagerFlagRequest>,
	reply: FastifyReply<ManagerFlagRequest>,
): Promise<void> => {
	const target = await request.server.core.user.one({
		where: { id: request.params.id },
		select: { id: true, role: true, status: true },
	});

	if (!target || target.role !== ROLES.MANAGER) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Manager not found." });
	}
	if (target.status !== USER_STATUS.ACTIVE) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "Only an active Manager can be flagged." });
	}

	const updated = await new ModerationManager(
		request.server.core,
	).applyUserStatusChange({
		userId: target.id,
		status: USER_STATUS.FLAGGED,
		action: TIMELINE_ACTION.FLAGGED,
		reason: request.body.reason,
		changedBy: request.user!.id,
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Manager flagged.", data: updated });
};

export const staffApprove = async (
	request: FastifyRequest<StaffApproveRequest>,
	reply: FastifyReply<StaffApproveRequest>,
): Promise<void> => {
	const target = await request.server.core.user.one({
		where: { id: request.params.id },
		select: { id: true, role: true, status: true, facility_id: true },
	});

	if (
		!target ||
		!(target.role === ROLES.NURSE || target.role === ROLES.DOCTOR) ||
		!target.facility_id
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply
			.status(status)
			.send({ code, message: "Staff application not found." });
	}
	if (target.status !== USER_STATUS.PENDING) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "Only a pending application can be approved." });
	}
	const hasActiveManager =
		(await request.server.core.user.count({
			facility_id: target.facility_id,
			role: ROLES.MANAGER,
			status: USER_STATUS.ACTIVE,
		})) > 0;
	if (hasActiveManager) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"This facility has an active Manager — they handle staff approval.",
		});
	}

	const updated = await new ModerationManager(
		request.server.core,
	).applyUserStatusChange({
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
	const target = await request.server.core.user.one({
		where: { id: request.params.id },
		select: { id: true, role: true, status: true, facility_id: true },
	});

	if (
		!target ||
		!(target.role === ROLES.NURSE || target.role === ROLES.DOCTOR) ||
		!target.facility_id
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply
			.status(status)
			.send({ code, message: "Staff application not found." });
	}
	if (target.status !== USER_STATUS.PENDING) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "Only a pending application can be rejected." });
	}
	const hasActiveManager =
		(await request.server.core.user.count({
			facility_id: target.facility_id,
			role: ROLES.MANAGER,
			status: USER_STATUS.ACTIVE,
		})) > 0;
	if (hasActiveManager) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"This facility has an active Manager — they handle staff rejection.",
		});
	}

	const updated = await new ModerationManager(
		request.server.core,
	).applyUserStatusChange({
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

export const staffFlag = async (
	request: FastifyRequest<StaffFlagRequest>,
	reply: FastifyReply<StaffFlagRequest>,
): Promise<void> => {
	const target = await request.server.core.user.one({
		where: { id: request.params.id },
		select: { id: true, role: true, status: true, facility_id: true },
	});

	if (
		!target ||
		!(target.role === ROLES.NURSE || target.role === ROLES.DOCTOR) ||
		!target.facility_id
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply
			.status(status)
			.send({ code, message: "Staff member not found." });
	}
	if (target.status !== USER_STATUS.ACTIVE) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "Only an active staff member can be flagged." });
	}
	const hasActiveManager =
		(await request.server.core.user.count({
			facility_id: target.facility_id,
			role: ROLES.MANAGER,
			status: USER_STATUS.ACTIVE,
		})) > 0;
	if (hasActiveManager) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"This facility has an active Manager — they handle staff flagging.",
		});
	}

	const updated = await new ModerationManager(
		request.server.core,
	).applyUserStatusChange({
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

/**
 * Emergency override — unconditional, no orphan-facility check. The one
 * lever Administrator keeps over Nurse/Doctor accounts regardless of
 * whether their Manager is present (e.g. the Manager is unresponsive, or
 * is themselves the problem).
 */
export const staffDisable = async (
	request: FastifyRequest<StaffDisableRequest>,
	reply: FastifyReply<StaffDisableRequest>,
): Promise<void> => {
	const target = await request.server.core.user.one({
		where: { id: request.params.id },
		select: { id: true, role: true, status: true },
	});

	if (
		!target ||
		!(target.role === ROLES.NURSE || target.role === ROLES.DOCTOR)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply
			.status(status)
			.send({ code, message: "Staff member not found." });
	}
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

	const updated = await new ModerationManager(
		request.server.core,
	).applyUserStatusChange({
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

export const facilityApprove = async (
	request: FastifyRequest<FacilityApproveRequest>,
	reply: FastifyReply<FacilityApproveRequest>,
): Promise<void> => {
	const target = await request.server.core.facility.one({
		where: { id: request.params.id },
		select: { id: true, status: true },
	});

	if (!target) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Facility not found." });
	}
	if (target.status !== FACILITY_STATUS.PENDING) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "Only a pending facility can be approved." });
	}

	const updated = await new ModerationManager(
		request.server.core,
	).applyFacilityStatusChange({
		facilityId: target.id,
		status: FACILITY_STATUS.APPROVED,
		action: TIMELINE_ACTION.APPROVED,
		reason: request.body.notes ?? null,
		changedBy: request.user!.id,
		select: FACILITY_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Facility approved.", data: updated });
};

export const facilityReject = async (
	request: FastifyRequest<FacilityRejectRequest>,
	reply: FastifyReply<FacilityRejectRequest>,
): Promise<void> => {
	const target = await request.server.core.facility.one({
		where: { id: request.params.id },
		select: { id: true, status: true },
	});

	if (!target) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Facility not found." });
	}
	if (target.status !== FACILITY_STATUS.PENDING) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "Only a pending facility can be rejected." });
	}

	const updated = await new ModerationManager(
		request.server.core,
	).applyFacilityStatusChange({
		facilityId: target.id,
		status: FACILITY_STATUS.REJECTED,
		action: TIMELINE_ACTION.REJECTED,
		reason: request.body.reason,
		changedBy: request.user!.id,
		select: FACILITY_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Facility rejected.", data: updated });
};

export const facilityFlag = async (
	request: FastifyRequest<FacilityFlagRequest>,
	reply: FastifyReply<FacilityFlagRequest>,
): Promise<void> => {
	const target = await request.server.core.facility.one({
		where: { id: request.params.id },
		select: { id: true, status: true },
	});

	if (!target) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Facility not found." });
	}
	if (target.status !== FACILITY_STATUS.APPROVED) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "Only an approved facility can be flagged." });
	}

	const updated = await new ModerationManager(
		request.server.core,
	).applyFacilityStatusChange({
		facilityId: target.id,
		status: FACILITY_STATUS.FLAGGED,
		action: TIMELINE_ACTION.FLAGGED,
		reason: request.body.reason,
		changedBy: request.user!.id,
		select: FACILITY_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Facility flagged.", data: updated });
};

export const facilitySuspend = async (
	request: FastifyRequest<FacilitySuspendRequest>,
	reply: FastifyReply<FacilitySuspendRequest>,
): Promise<void> => {
	const target = await request.server.core.facility.one({
		where: { id: request.params.id },
		select: { id: true, status: true },
	});

	if (!target) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Facility not found." });
	}
	if (
		!(
			target.status === FACILITY_STATUS.APPROVED ||
			target.status === FACILITY_STATUS.FLAGGED
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "Only an approved or flagged facility can be suspended.",
		});
	}

	const updated = await new ModerationManager(
		request.server.core,
	).applyFacilityStatusChange({
		facilityId: target.id,
		status: FACILITY_STATUS.SUSPENDED,
		action: TIMELINE_ACTION.SUSPENDED,
		reason: request.body.reason,
		changedBy: request.user!.id,
		select: FACILITY_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Facility suspended.", data: updated });
};

export const userCreate = async (
	request: FastifyRequest<UserCreateRequest>,
	reply: FastifyReply<UserCreateRequest>,
): Promise<void> => {
	const { name, email, role, facility_id } = request.body;

	if (role !== ROLES.ADMINISTRATOR && facility_id) {
		const facility = await request.server.core.facility.one({
			where: { id: facility_id },
			select: { id: true, status: true },
		});

		if (!facility) {
			const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
			return reply
				.status(status)
				.send({ code, message: "Facility not found." });
		}
		if (facility.status !== FACILITY_STATUS.APPROVED) {
			const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
			return reply
				.status(status)
				.send({ code, message: "This facility isn't approved." });
		}
	}

	const temporaryPassword = generateTemporaryPassword();

	const created = await auth.api.signUpEmail({
		body: { name, email, password: temporaryPassword, role, facility_id },
	});

	await request.server.core.user.update({
		where: { id: created.user.id },
		data: { must_change_password: true },
		select: { id: true },
	});

	const user = await new ModerationManager(
		request.server.core,
	).applyUserStatusChange({
		userId: created.user.id,
		status: USER_STATUS.ACTIVE,
		action: TIMELINE_ACTION.APPROVED,
		reason: "Account created directly by an Administrator.",
		changedBy: request.user!.id,
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "User created.",
		data: { user, temporary_password: temporaryPassword },
	});
};

/**
 * Regenerates a user's password — the only recovery path when an
 * Administrator loses a just-issued (or any) temporary password before
 * sharing it, since it's hashed the moment it's set and never stored in
 * recoverable form. Same shape as `userCreate`'s password issuance: a
 * fresh one-time temporary password, returned exactly once, with
 * `must_change_password` set so the recipient is prompted to pick their
 * own on next use of that flow.
 */
export const userResetPassword = async (
	request: FastifyRequest<UserResetPasswordRequest>,
	reply: FastifyReply<UserResetPasswordRequest>,
): Promise<void> => {
	const target = await request.server.core.user.one({
		where: { id: request.params.id },
		select: USER_FIELDS,
	});

	if (!target) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "User not found." });
	}

	const account = await request.server.core.account.one({
		where: { user_id: target.id },
		select: { id: true },
	});

	if (!account) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply
			.status(status)
			.send({ code, message: "No credential account found for this user." });
	}

	const temporaryPassword = generateTemporaryPassword();

	await request.server.core.account.update({
		where: { id: account.id },
		data: { password: await hashPassword(temporaryPassword) },
		select: { id: true },
	});

	const [user] = await request.server.core.user.update({
		where: { id: target.id },
		data: { must_change_password: true },
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Password reset.",
		data: { user, temporary_password: temporaryPassword },
	});
};

const appealDecide = async (
	request: FastifyRequest<AppealApproveRequest>,
	reply: FastifyReply<AppealApproveRequest>,
	approve: boolean,
): Promise<void> => {
	const appeal = await request.server.core.timeline.one({
		where: { id: request.params.id },
		select: { id: true, type: true, entity: true, action: true },
	});

	if (!appeal || appeal.action !== TIMELINE_ACTION.APPEAL_SUBMITTED) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Appeal not found." });
	}

	if (!(await request.server.management.appeal.isOpen(appeal))) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply
			.status(status)
			.send({ code, message: "This appeal has already been decided." });
	}

	const entry = await request.server.core.connection.transaction(async (tx) => {
		const txCore = request.server.core.withTransaction(tx);

		return new AppealManager(txCore).decide({
			type: appeal.type as TimelineType,
			entity: appeal.entity,
			approve,
			notes: request.body.notes,
			decidedBy: request.user!.id,
		});
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: approve ? "Appeal approved." : "Appeal denied.",
		data: {
			...entry,
			changer: { id: request.user!.id, name: request.user!.name },
		},
	});
};

export const appealApprove = (
	request: FastifyRequest<AppealApproveRequest>,
	reply: FastifyReply<AppealApproveRequest>,
): Promise<void> => appealDecide(request, reply, true);

export const appealDeny = (
	request: FastifyRequest<AppealDenyRequest>,
	reply: FastifyReply<AppealDenyRequest>,
): Promise<void> => appealDecide(request, reply, false);

/**
 * Bare-bones queue — every submitted appeal, system-wide. Administrator is
 * the universal fallback decider (see `management/appeal.ts`'s
 * `resolveAuthority`), so unlike Manager's own `GET /manager/appeals` this
 * doesn't need to filter by who's actually allowed to decide each one —
 * the decide endpoints re-validate that regardless.
 */
export const appeals = async (
	request: FastifyRequest<AppealsRequest>,
	reply: FastifyReply<AppealsRequest>,
): Promise<void> => {
	const { page, limit } = parsePagination(request.query);

	const result = await request.server.management.appeal.list({ page, limit });
	const by_type = await request.server.management.appeal.countByType();

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Appeals retrieved.",
		...result,
		by_type,
	});
};
