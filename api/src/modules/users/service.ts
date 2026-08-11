import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	roleSchema,
	TIMELINE_TYPE,
	REFERRAL_STATUS,
	userStatusSchema,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	HTTP_RESPONSE_CODE,
	orderDirectionSchema,
	type Role,
	type UserDetailResponse,
} from "@referral-tracking/shared";

import { zeroFillCounts } from "../../lib/util";
import { parseEnumList, parseSortList } from "../../lib/validator";
import { canViewUser } from "../../lib/permission";

import { UserModel, type UserModelSelect } from "../../drizzle/schema";

import type { CoreService } from "../../core";

import type { OrderClause, WhereClause } from "../../core/helpers";

import type { UsersRequest, UserRequest, UserHistoryRequest } from "./type";

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

export const users = async (
	request: FastifyRequest<UsersRequest>,
	reply: FastifyReply<UsersRequest>,
): Promise<void> => {
	const { query, server } = request;

	const page = Number(query.page);
	const limit = Number(query.limit);

	const role = request.user!.role as Role;

	const where: WhereClause<UserModelSelect> = {};
	if (role === ROLES.MANAGER) where.facility_id = request.user!.facility_id!;

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

	const sorts = parseSortList(query.sort, UserModel, "created_at");
	const orders = parseEnumList(query.order, orderDirectionSchema) ?? ["desc"];
	const order = Object.fromEntries(
		sorts.map((sorting, index) => [
			sorting,
			orders[index] || orders[0] || "desc",
		]),
	) as OrderClause<UserModelSelect>;

	const result = await server.core.user.many({
		page,
		limit,
		where,
		order,
		select: USER_FIELDS,
	});

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Users retrieved.",
		...result,
	});
};

/**
 * No `disableUser` — `PATCH /users/:id/disable` is removed. It let
 * Administrator disable *any* user unconditionally with no recorded
 * reason, which contradicts the new authority model (Administrator
 * moderates Managers, Manager moderates their own Nurse/Doctor staff,
 * always with a reason). Fully superseded by the role-first moderation
 * endpoints in `modules/administrator` and `modules/manager`.
 */

const doctorStats = async (
	core: Pick<CoreService, "referral">,
	doctorId: string,
): Promise<UserDetailResponse["data"]["stats"]> => {
	const counts = zeroFillCounts(
		await core.referral.count({ doctor: doctorId }, "status"),
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

export const user = async (
	request: FastifyRequest<UserRequest>,
	reply: FastifyReply<UserRequest>,
): Promise<void> => {
	const role = request.user!.role as Role;

	const user = await request.server.core.user.one({
		where: { id: request.params.id },
		select: USER_FIELDS,
		include: USER_INCLUDE,
	});

	if (!user || !canViewUser(role, request.user!.facility_id, user)) {
		const { status, code } = HTTP_RESPONSE_CODE.NOT_FOUND;
		return reply.status(status).send({ code, message: "User not found." });
	}

	const stats =
		user.role === ROLES.DOCTOR
			? await doctorStats(request.server.core, user.id)
			: undefined;

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "User retrieved.",
		// `include`-derived fields (`facility`) aren't modeled by `WithCount` —
		// present at runtime, just invisible to this type. See `core/helpers.ts`.
		data: { ...user, stats } as unknown as UserDetailResponse["data"],
	});
};

export const userHistory = async (
	request: FastifyRequest<UserHistoryRequest>,
	reply: FastifyReply<UserHistoryRequest>,
): Promise<void> => {
	const role = request.user!.role as Role;

	const user = await request.server.core.user.one({
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

	const result = await request.server.core.timeline.many({
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
