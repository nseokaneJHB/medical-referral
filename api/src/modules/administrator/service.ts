import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	USER_STATUS,
	FACILITY_STATUS,
	TIMELINE_ACTION,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	HTTP_RESPONSE_CODE,
	type TimelineType,
} from "@referral-tracking/shared";

import { auth } from "../../lib/auth";
import { hashPassword } from "../../lib/password";
import { generateTemporaryPassword } from "../../lib/util";

import { userOne, userCount, userUpdate } from "../../repository/user";
import { accountOne, accountUpdate } from "../../repository/account";
import { facilityOne } from "../../repository/facility";
import { timelineOne } from "../../repository/timeline";
import {
	appealList,
	appealDecide,
	appealIsOpen,
	appealCountByType,
} from "../../repository/cross-schema/appeal";
import {
	moderationApplyUserStatusChange,
	moderationApplyFacilityStatusChange,
} from "../../repository/cross-schema/moderation";

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

/** Approves a Manager application; if it included a new facility, approves that facility too in the same transaction, since they were paired PENDING together. */
export const managerApprove = async (
	request: FastifyRequest<ManagerApproveRequest>,
	reply: FastifyReply<ManagerApproveRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await userOne(database, {
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

	await database.transaction(async (tx) => {
		await moderationApplyUserStatusChange(tx, {
			userId: target.id,
			status: USER_STATUS.ACTIVE,
			action: TIMELINE_ACTION.APPROVED,
			reason: request.body.notes ?? null,
			changedBy: request.user!.id,
			select: { id: true },
		});

		if (target.facility_id) {
			const facility = await facilityOne(tx, {
				where: { id: target.facility_id },
				select: { status: true },
			});

			if (facility?.status === FACILITY_STATUS.PENDING) {
				await moderationApplyFacilityStatusChange(tx, {
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

	const updated = await userOne(database, {
		where: { id: target.id },
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Manager approved.", data: updated! });
};

/** Rejects a Manager application; if it included a new facility, rejects that facility too in the same transaction. */
export const managerReject = async (
	request: FastifyRequest<ManagerRejectRequest>,
	reply: FastifyReply<ManagerRejectRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await userOne(database, {
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

	await database.transaction(async (tx) => {
		await moderationApplyUserStatusChange(tx, {
			userId: target.id,
			status: USER_STATUS.REJECTED,
			action: TIMELINE_ACTION.REJECTED,
			reason: request.body.reason,
			changedBy: request.user!.id,
			select: { id: true },
		});

		if (target.facility_id) {
			const facility = await facilityOne(tx, {
				where: { id: target.facility_id },
				select: { status: true },
			});

			if (facility?.status === FACILITY_STATUS.PENDING) {
				await moderationApplyFacilityStatusChange(tx, {
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

	const updated = await userOne(database, {
		where: { id: target.id },
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply
		.status(status)
		.send({ code, message: "Manager rejected.", data: updated! });
};

/** Disables an active or flagged Manager. */
export const managerDisable = async (
	request: FastifyRequest<ManagerDisableRequest>,
	reply: FastifyReply<ManagerDisableRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await userOne(database, {
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

	const updated = await moderationApplyUserStatusChange(database, {
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

/** Flags an active Manager for review. */
export const managerFlag = async (
	request: FastifyRequest<ManagerFlagRequest>,
	reply: FastifyReply<ManagerFlagRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await userOne(database, {
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

	const updated = await moderationApplyUserStatusChange(database, {
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

/** Approves a pending Nurse/Doctor application — Administrator-only fallback for a facility with no active Manager. */
export const staffApprove = async (
	request: FastifyRequest<StaffApproveRequest>,
	reply: FastifyReply<StaffApproveRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await userOne(database, {
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
		(await userCount(database, {
			where: {
				facility_id: target.facility_id,
				role: ROLES.MANAGER,
				status: USER_STATUS.ACTIVE,
			},
		})) > 0;
	if (hasActiveManager) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"This facility has an active Manager — they handle staff approval.",
		});
	}

	const updated = await moderationApplyUserStatusChange(database, {
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

/** Rejects a pending Nurse/Doctor application — Administrator-only fallback for a facility with no active Manager. */
export const staffReject = async (
	request: FastifyRequest<StaffRejectRequest>,
	reply: FastifyReply<StaffRejectRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await userOne(database, {
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
		(await userCount(database, {
			where: {
				facility_id: target.facility_id,
				role: ROLES.MANAGER,
				status: USER_STATUS.ACTIVE,
			},
		})) > 0;
	if (hasActiveManager) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"This facility has an active Manager — they handle staff rejection.",
		});
	}

	const updated = await moderationApplyUserStatusChange(database, {
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

/** Flags an active Nurse/Doctor — Administrator-only fallback for a facility with no active Manager. */
export const staffFlag = async (
	request: FastifyRequest<StaffFlagRequest>,
	reply: FastifyReply<StaffFlagRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await userOne(database, {
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
		(await userCount(database, {
			where: {
				facility_id: target.facility_id,
				role: ROLES.MANAGER,
				status: USER_STATUS.ACTIVE,
			},
		})) > 0;
	if (hasActiveManager) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"This facility has an active Manager — they handle staff flagging.",
		});
	}

	const updated = await moderationApplyUserStatusChange(database, {
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

/** Emergency override — disables a Nurse/Doctor unconditionally, no orphan-facility check, regardless of whether their Manager is present. */
export const staffDisable = async (
	request: FastifyRequest<StaffDisableRequest>,
	reply: FastifyReply<StaffDisableRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await userOne(database, {
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

	const updated = await moderationApplyUserStatusChange(database, {
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

/** Approves a pending facility. */
export const facilityApprove = async (
	request: FastifyRequest<FacilityApproveRequest>,
	reply: FastifyReply<FacilityApproveRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await facilityOne(database, {
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

	const updated = await moderationApplyFacilityStatusChange(database, {
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

/** Rejects a pending facility. */
export const facilityReject = async (
	request: FastifyRequest<FacilityRejectRequest>,
	reply: FastifyReply<FacilityRejectRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await facilityOne(database, {
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

	const updated = await moderationApplyFacilityStatusChange(database, {
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

/** Flags an approved facility for review. */
export const facilityFlag = async (
	request: FastifyRequest<FacilityFlagRequest>,
	reply: FastifyReply<FacilityFlagRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await facilityOne(database, {
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

	const updated = await moderationApplyFacilityStatusChange(database, {
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

/** Suspends an approved or flagged facility. */
export const facilitySuspend = async (
	request: FastifyRequest<FacilitySuspendRequest>,
	reply: FastifyReply<FacilitySuspendRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await facilityOne(database, {
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

	const updated = await moderationApplyFacilityStatusChange(database, {
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

/** Creates a user directly with a one-time temporary password, active immediately. */
export const userCreate = async (
	request: FastifyRequest<UserCreateRequest>,
	reply: FastifyReply<UserCreateRequest>,
): Promise<void> => {
	const database = request.server.database;
	const { name, email, role, facility_id } = request.body;

	if (role !== ROLES.ADMINISTRATOR && facility_id) {
		const facility = await facilityOne(database, {
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

	await userUpdate(
		database,
		{ where: { id: created.user.id }, select: { id: true } },
		{ must_change_password: true },
	);

	const user = await moderationApplyUserStatusChange(database, {
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

/** Regenerates a user's password with a fresh one-time temporary password, returned exactly once — the only recovery path since a password is never stored in recoverable form. */
export const userResetPassword = async (
	request: FastifyRequest<UserResetPasswordRequest>,
	reply: FastifyReply<UserResetPasswordRequest>,
): Promise<void> => {
	const database = request.server.database;

	const target = await userOne(database, {
		where: { id: request.params.id },
		select: USER_FIELDS,
	});

	if (!target) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "User not found." });
	}

	const account = await accountOne(database, {
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

	await accountUpdate(
		database,
		{ where: { id: account.id }, select: { id: true } },
		{ password: await hashPassword(temporaryPassword) },
	);

	const [user] = await userUpdate(
		database,
		{ where: { id: target.id }, select: USER_FIELDS },
		{ must_change_password: true },
	);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Password reset.",
		data: { user, temporary_password: temporaryPassword },
	});
};

/** Shared decide logic for `appealApprove`/`appealDeny`. */
const decideAppeal = async (
	request: FastifyRequest<AppealApproveRequest>,
	reply: FastifyReply<AppealApproveRequest>,
	approve: boolean,
): Promise<void> => {
	const database = request.server.database;

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

	const entry = await database.transaction(async (tx) =>
		appealDecide(tx, {
			type: appeal.type as TimelineType,
			entity: appeal.entity,
			approve,
			notes: request.body.notes,
			decidedBy: request.user!.id,
		}),
	);

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

/** Approves any open appeal, system-wide. */
export const appealApprove = (
	request: FastifyRequest<AppealApproveRequest>,
	reply: FastifyReply<AppealApproveRequest>,
): Promise<void> => decideAppeal(request, reply, true);

/** Denies any open appeal, system-wide. */
export const appealDeny = (
	request: FastifyRequest<AppealDenyRequest>,
	reply: FastifyReply<AppealDenyRequest>,
): Promise<void> => decideAppeal(request, reply, false);

/** Lists every submitted appeal, system-wide — unlike Manager's own queue, unfiltered, since the decide endpoints re-validate authority regardless. */
export const appeals = async (
	request: FastifyRequest<AppealsRequest>,
	reply: FastifyReply<AppealsRequest>,
): Promise<void> => {
	const database = request.server.database;
	const page = request.query.page
		? Number(request.query.page)
		: DEFAULT_PAGE_NUMBER;
	const limit = request.query.limit
		? Number(request.query.limit)
		: DEFAULT_PAGE_LIMIT;

	const result = await appealList(database, { page, limit });
	const by_type = await appealCountByType(database);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Appeals retrieved.",
		...result,
		by_type,
	});
};
