import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	PRIORITY,
	REFERRAL_STATUS,
	HTTP_RESPONSE_CODE,
} from "@referral-tracking/shared";

import { zeroFillCounts, localDateStartToUtc } from "../../lib/util";

import { referralCount } from "../../repository/referral";

import type { WhereClause } from "../../repository/helpers";

import type { ReferralModelSelect } from "../../drizzle/schema";

import type { ReferralsReportRequest } from "./type";

/** Role-scoped per build-spec.md's Phase 7 table — Admin sees every referral, Doctor only their own, Nurse only ones they created; `from`/`to` filter on `created_at`. */
export const referralsReport = async (
	request: FastifyRequest<ReferralsReportRequest>,
	reply: FastifyReply<ReferralsReportRequest>,
): Promise<void> => {
	const database = request.server.database;
	const role = request.user!.role;

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
			gte: localDateStartToUtc(request.query.from, request.query.tz_offset),
		};
	}
	if (request.query.to) {
		const end = localDateStartToUtc(request.query.to, request.query.tz_offset);
		end.setUTCDate(end.getUTCDate() + 1);
		where.created_at = { ...where.created_at, lt: end };
	}

	const [rawStatusCounts, rawPriorityCounts] = await Promise.all([
		referralCount(database, { where, groupBy: "status" }),
		referralCount(database, { where, groupBy: "priority" }),
	]);

	const statusCounts = zeroFillCounts(rawStatusCounts, REFERRAL_STATUS);
	const priorityCounts = zeroFillCounts(rawPriorityCounts, PRIORITY);

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
