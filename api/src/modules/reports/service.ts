import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	PRIORITY,
	REFERRAL_STATUS,
	HTTP_RESPONSE_CODE,
	type Role,
} from "@referral-tracking/shared";

import { zeroFillCounts } from "../../lib/util";

import type { WhereClause } from "../../core/helpers";

import type { ReferralModelSelect } from "../../drizzle/schema";

import type { ReferralsReportRequest } from "./type";

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
	const { core } = request.server;
	const role = request.user!.role as Role;

	const where: WhereClause<ReferralModelSelect> = {};

	if (role === ROLES.NURSE) where.referrer_id = request.user!.id;
	if (role === ROLES.DOCTOR) {
		where.OR = [
			{ doctor: request.user!.id },
			{
				doctor: { isNull: true },
				destination_facility_id: request.user!.facility_id!,
			},
		];
	}
	if (role === ROLES.MANAGER) {
		const facilityId = request.user!.facility_id!;
		where.OR = [
			{ origin_facility_id: facilityId },
			{ destination_facility_id: facilityId },
		];
	}

	if (request.query.from) {
		where.created_at = {
			...where.created_at,
			gte: new Date(`${request.query.from}T00:00:00.000Z`),
		};
	}
	if (request.query.to) {
		const end = new Date(`${request.query.to}T00:00:00.000Z`);
		end.setUTCDate(end.getUTCDate() + 1);
		where.created_at = { ...where.created_at, lt: end };
	}

	const [rawStatusCounts, rawPriorityCounts] = await Promise.all([
		core.referral.count(where, "status"),
		core.referral.count(where, "priority"),
	]);

	const statusCounts = zeroFillCounts(rawStatusCounts, REFERRAL_STATUS);
	const priorityCounts = zeroFillCounts(rawPriorityCounts, PRIORITY);

	// Field names here are the report's own stable shape, decoupled from
	// `REFERRAL_STATUS`'s casing — same remap `dashboard/service.ts` already
	// does for its per-status counts.
	const byStatus = {
		pending: statusCounts[REFERRAL_STATUS.PENDING],
		accepted: statusCounts[REFERRAL_STATUS.ACCEPTED],
		in_progress: statusCounts[REFERRAL_STATUS.IN_PROGRESS],
		on_hold: statusCounts[REFERRAL_STATUS.ON_HOLD],
		completed: statusCounts[REFERRAL_STATUS.COMPLETED],
		rejected: statusCounts[REFERRAL_STATUS.REJECTED],
		canceled: statusCounts[REFERRAL_STATUS.CANCELED],
	};
	const byPriority = {
		low: priorityCounts[PRIORITY.LOW],
		medium: priorityCounts[PRIORITY.MEDIUM],
		high: priorityCounts[PRIORITY.HIGH],
		urgent: priorityCounts[PRIORITY.URGENT],
	};

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
