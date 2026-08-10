import type { FastifyReply, FastifyRequest } from "fastify";

import { sql, eq, or, and, gte, lt, type SQL } from "drizzle-orm";

import {
	ROLES,
	PRIORITY,
	REFERRAL_STATUS,
	HTTP_RESPONSE_CODE,
	type Role,
	type ReferralsReportResponse,
} from "@referral-tracking/shared";

import { ReferralModel } from "../../drizzle/schema";

import type { Database } from "../../core/helpers";

import type { ReferralsReportRequest } from "./type";

const groupCount = async (
	connection: Database,
	column: typeof ReferralModel.status | typeof ReferralModel.priority,
	where: SQL<unknown> | undefined,
	values: string[],
): Promise<Record<string, number>> => {
	const rows = await connection
		.select({ key: column, count: sql<number>`count(*)` })
		.from(ReferralModel)
		.where(where)
		.groupBy(column);

	const counts = Object.fromEntries(values.map((value) => [value, 0]));
	for (const row of rows) counts[row.key] = Number(row.count);

	return counts;
};

/**
 * Role-scoped per build-spec.md's Phase 7 table: Admin sees every referral,
 * Doctor sees only ones assigned to them, Nurse sees only ones they
 * created — same scoping rule as `GET /referrals`. `from`/`to` filter on
 * `created_at`.
 */
export const referralsReport = async (
	request: FastifyRequest<ReferralsReportRequest>,
	reply: FastifyReply<ReferralsReportRequest>,
): Promise<void> => {
	const { connection } = request.server.core;
	const role = request.user!.role as Role;

	const conditions: SQL<unknown>[] = [];

	if (role === ROLES.NURSE) {
		conditions.push(eq(ReferralModel.referrer_id, request.user!.id));
	}
	if (role === ROLES.DOCTOR) {
		conditions.push(eq(ReferralModel.doctor, request.user!.id));
	}
	if (role === ROLES.MANAGER) {
		const facilityId = request.user!.facility_id!;
		conditions.push(
			or(
				eq(ReferralModel.origin_facility_id, facilityId),
				eq(ReferralModel.destination_facility_id, facilityId),
			)!,
		);
	}

	if (request.query.from) {
		conditions.push(
			gte(
				ReferralModel.created_at,
				new Date(`${request.query.from}T00:00:00.000Z`),
			),
		);
	}
	if (request.query.to) {
		const end = new Date(`${request.query.to}T00:00:00.000Z`);
		end.setUTCDate(end.getUTCDate() + 1);
		conditions.push(lt(ReferralModel.created_at, end));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [byStatus, byPriority] = (await Promise.all([
		groupCount(
			connection,
			ReferralModel.status,
			where,
			Object.values(REFERRAL_STATUS),
		),
		groupCount(
			connection,
			ReferralModel.priority,
			where,
			Object.values(PRIORITY),
		),
	])) as [
		ReferralsReportResponse["data"]["by_status"],
		ReferralsReportResponse["data"]["by_priority"],
	];

	const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Referrals report retrieved.",
		data: {
			total,
			by_status: byStatus,
			by_priority: byPriority,
		},
	});
};
