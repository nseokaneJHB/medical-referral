import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	roleSchema,
	USER_STATUS,
	TIMELINE_TYPE,
	REFERRAL_STATUS,
	userStatusSchema,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	HTTP_RESPONSE_CODE,
	type Role,
	type UserDetailResponse,
} from "@referral-tracking/shared";

import { zeroFillCounts, generateUuid } from "../../lib/util";
import { parseEnumList } from "../../lib/validator";
import { canViewUser, canManagerActOnStaff } from "../../lib/permission";

import { userOne, userMany, userCount } from "../../repository/user";
import { accountOne } from "../../repository/account";
import { timelineMany } from "../../repository/timeline";
import { referralCount } from "../../repository/referral";
import {
	specialtyOne,
	specialtyLinkMany,
	specialtyLinkCreate,
	specialtyLinkDelete,
} from "../../repository/specialty";
import { autoAssignmentRecheckFacility } from "../../repository/cross-schema/auto-assignment";

import { UserModel, type UserModelSelect } from "../../drizzle/schema";

import { buildOrderClause, type Executor, type WhereClause } from "../../repository/helpers";

import type {
	UsersRequest,
	UserRequest,
	UserHistoryRequest,
	UserSpecialtiesRequest,
	UserSpecialtyAssignRequest,
	UserSpecialtyUnassignRequest,
} from "./type";

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

const USER_INCLUDE = {
	facility: { select: { id: true, name: true } },
} as const;

/** Lists users with pagination/role/status/search filtering, role-scoped to the caller's own facility for a Manager. */
export const users = async (
	request: FastifyRequest<UsersRequest>,
	reply: FastifyReply<UsersRequest>,
): Promise<void> => {
	const { query, server } = request;
	const database = server.database;

	const page = Number(query.page);
	const limit = Number(query.limit);

	const role = request.user!.role;

	const where: WhereClause<UserModelSelect> = {};
	if (role === ROLES.MANAGER) where.facility_id = request.user!.facility_id!;

	const roleScopeWhere: WhereClause<UserModelSelect> = { ...where };

	if (query.role) {
		where.role = { in: parseEnumList(query.role, roleSchema) };
	}

	if (query.status) {
		where.status = { in: parseEnumList(query.status, userStatusSchema) };
	}

	if (query.search) {
		where.OR = [
			{ name: { contains: query.search, mode: "insensitive" } },
			{ email: { contains: query.search, mode: "insensitive" } },
		];
	}

	const order = buildOrderClause<UserModelSelect>(
		query.sort,
		query.order,
		UserModel,
		"created_at",
		"desc",
	);

	const result = await userMany(database, {
		page,
		limit,
		where,
		order,
		select: USER_FIELDS,
	});

	const pendingApplications = await userCount(database, {
		where: { ...roleScopeWhere, status: USER_STATUS.PENDING },
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Users retrieved.",
		...result,
		pending_applications: pendingApplications,
	});
};

/** No `disableUser` — superseded by the role-first moderation endpoints in `modules/administrator` and `modules/manager`, which always record a reason. */

/** Computes a doctor's referral totals/completion-rate stat block. */
const doctorStats = async (
	database: Executor,
	doctorId: string,
): Promise<UserDetailResponse["data"]["stats"]> => {
	const counts = zeroFillCounts(
		await referralCount(database, { where: { doctor: doctorId }, groupBy: "status" }),
		REFERRAL_STATUS,
	);

	const total = Object.values(counts).reduce((a, b) => a + b, 0);
	const completed = counts[REFERRAL_STATUS.COMPLETED];

	return {
		total_referrals: total,
		completed_referrals: completed,
		completion_rate: total === 0 ? 0 : completed / total,
	};
};

/** Fetches a single user, with a doctor's referral stats attached when applicable. */
export const user = async (
	request: FastifyRequest<UserRequest>,
	reply: FastifyReply<UserRequest>,
): Promise<void> => {
	const role = request.user!.role;
	const database = request.server.database;

	const user = await userOne(database, {
		where: { id: request.params.id },
		select: USER_FIELDS,
		include: USER_INCLUDE,
	});

	if (!user || !canViewUser(role, request.user!.facility_id, user)) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "User not found." });
	}

	const stats =
		user.role === ROLES.DOCTOR ? await doctorStats(database, user.id) : undefined;

	const account = await accountOne(database, {
		where: { user_id: user.id },
		select: { updated_at: true },
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "User retrieved.",
		data: {
			...user,
			stats,
			password_set_at: account?.updated_at ?? null,
		},
	});
};

/** Lists a user's moderation/status timeline, paginated. */
export const userHistory = async (
	request: FastifyRequest<UserHistoryRequest>,
	reply: FastifyReply<UserHistoryRequest>,
): Promise<void> => {
	const role = request.user!.role;
	const database = request.server.database;

	const user = await userOne(database, {
		where: { id: request.params.id },
		select: { id: true, facility_id: true },
	});

	if (!user || !canViewUser(role, request.user!.facility_id, user)) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "User not found." });
	}

	const page = request.query.page
		? Number(request.query.page)
		: DEFAULT_PAGE_NUMBER;
	const limit = request.query.limit
		? Number(request.query.limit)
		: DEFAULT_PAGE_LIMIT;

	const result = await timelineMany(database, {
		page,
		limit,
		where: { type: TIMELINE_TYPE.USER, entity: request.params.id },
		order: { changed_at: "desc" },
		select: TIMELINE_FIELDS,
		include: TIMELINE_INCLUDE,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "User history retrieved.",
		...result,
	});
};

/** Manager-only, and only for their own facility's Doctors/Nurses — Administrator manages the specialty vocabulary itself, not any one user's assignments. */
const canManageStaffSpecialties = (
	role: Role,
	caller: Pick<UserModelSelect, "facility_id">,
	target: Pick<UserModelSelect, "role" | "facility_id">,
): boolean => {
	if (target.role !== ROLES.DOCTOR && target.role !== ROLES.NURSE) return false;
	if (role === ROLES.MANAGER) return canManagerActOnStaff(caller, target);
	return false;
};

/** Lists a user's assigned specialties. */
export const userSpecialties = async (
	request: FastifyRequest<UserSpecialtiesRequest>,
	reply: FastifyReply<UserSpecialtiesRequest>,
): Promise<void> => {
	const role = request.user!.role;
	const database = request.server.database;

	const target = await userOne(database, {
		where: { id: request.params.id },
		select: { id: true, role: true, facility_id: true },
	});

	if (!target || !canViewUser(role, request.user!.facility_id, target)) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "User not found." });
	}

	const result = await specialtyLinkMany(database, {
		owner: "user",
		page: 1,
		limit: 100,
		where: { user_id: request.params.id },
		select: { id: true, user_id: true, created_at: true },
		include: {
			specialty: { select: { id: true, name: true, description: true } },
		},
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "User specialties retrieved.",
		data: result.data,
	});
};

/** Assigns a specialty to a Doctor/Nurse, then best-effort re-triggers auto-assignment recheck if the target is a Doctor. */
export const userSpecialtyAssign = async (
	request: FastifyRequest<UserSpecialtyAssignRequest>,
	reply: FastifyReply<UserSpecialtyAssignRequest>,
): Promise<void> => {
	const role = request.user!.role;
	const database = request.server.database;

	const target = await userOne(database, {
		where: { id: request.params.id },
		select: { id: true, role: true, facility_id: true },
	});

	if (!target) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "User not found." });
	}

	if (
		!canManageStaffSpecialties(
			role,
			{ facility_id: request.user!.facility_id },
			target,
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"You may only manage specialties for your own facility's Doctors/Nurses.",
		});
	}

	const specialty = await specialtyOne(database, {
		where: { id: request.body.specialty_id },
		select: { id: true, name: true, description: true },
	});

	if (!specialty) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "Specialty not found." });
	}

	const existing = await specialtyLinkMany(database, {
		owner: "user",
		page: 1,
		limit: 1,
		where: {
			user_id: request.params.id,
			specialty_id: request.body.specialty_id,
		},
		select: { id: true },
	});

	if (existing.data.length > 0) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "This specialty is already assigned to this user.",
		});
	}

	const [link] = await specialtyLinkCreate(
		database,
		{ owner: "user", select: { id: true, user_id: true, created_at: true } },
		{
			id: generateUuid(),
			user_id: request.params.id,
			specialty_id: request.body.specialty_id,
		},
	);

	if (target.role === ROLES.DOCTOR && target.facility_id) {
		try {
			await autoAssignmentRecheckFacility(database, {
				facilityId: target.facility_id,
			});
		} catch (error) {
			request.log.error(
				{ error, userId: target.id },
				"Auto-assignment recheck failed after granting a specialty.",
			);
		}
	}

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Specialty assigned.",
		data: { ...link, specialty },
	});
};

/** Unassigns a specialty from a Doctor/Nurse. */
export const userSpecialtyUnassign = async (
	request: FastifyRequest<UserSpecialtyUnassignRequest>,
	reply: FastifyReply<UserSpecialtyUnassignRequest>,
): Promise<void> => {
	const role = request.user!.role;
	const database = request.server.database;

	const target = await userOne(database, {
		where: { id: request.params.id },
		select: { id: true, role: true, facility_id: true },
	});

	if (!target) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "User not found." });
	}

	if (
		!canManageStaffSpecialties(
			role,
			{ facility_id: request.user!.facility_id },
			target,
		)
	) {
		const { status, code } = HTTP_RESPONSE_CODE.FORBIDDEN;
		return reply.status(status).send({
			code,
			message:
				"You may only manage specialties for your own facility's Doctors/Nurses.",
		});
	}

	const deleted = await specialtyLinkDelete(database, {
		owner: "user",
		where: {
			user_id: request.params.id,
			specialty_id: request.params.specialtyId,
		},
		select: { id: true },
	});

	if (deleted.length === 0) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({
			code,
			message: "This specialty isn't assigned to this user.",
		});
	}

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({ code, message: "Specialty unassigned." });
};
