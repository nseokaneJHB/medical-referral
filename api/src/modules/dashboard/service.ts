import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	USER_STATUS,
	REFERRAL_STATUS,
	HTTP_RESPONSE_CODE,
} from "@referral-tracking/shared";

import { zeroFillCounts, localDateStartToUtc } from "../../lib/util";
import { TransferManager } from "../../management/transfer";

import type { WhereClause, WhereOperator } from "../../core/helpers";
import type { ReferralModelSelect } from "../../drizzle/schema";

import type {
	NurseSummaryRequest,
	DoctorSummaryRequest,
	AdminSummaryRequest,
	ManagerSummaryRequest,
} from "./type";

/** `to` is inclusive of that whole day, so the upper bound is midnight of the day after. */
const buildDateRangeFilter = (
	from?: string,
	to?: string,
	tzOffset?: string,
): WhereOperator<Date> | undefined => {
	if (!from && !to) return undefined;

	const filter: WhereOperator<Date> = {};
	if (from) filter.gte = localDateStartToUtc(from, tzOffset);
	if (to) {
		const end = localDateStartToUtc(to, tzOffset);
		end.setUTCDate(end.getUTCDate() + 1);
		filter.lt = end;
	}
	return filter;
};

const sumCounts = (counts: Record<string, number>): number =>
	Object.values(counts).reduce((a, b) => a + b, 0);

/**
 * PDF Nurse Dashboard widgets: "Referrals Created, Pending Referrals,
 * Canceled Referrals, Referrals on hold".
 */
export const nurseSummary = async (
	request: FastifyRequest<NurseSummaryRequest>,
	reply: FastifyReply<NurseSummaryRequest>,
): Promise<void> => {
	const { core } = request.server;

	const where: { referrer_id: string; created_at?: WhereOperator<Date> } = {
		referrer_id: request.user!.id,
	};

	const dateFilter = buildDateRangeFilter(
		request.query.from,
		request.query.to,
		request.query.tz_offset,
	);
	if (dateFilter) where.created_at = dateFilter;

	const counts = zeroFillCounts(
		await core.referral.count(where, "status"),
		REFERRAL_STATUS,
	);

	const referralsCreated = sumCounts(counts);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Nurse dashboard summary retrieved.",
		data: {
			referrals_created: referralsCreated,
			pending: counts[REFERRAL_STATUS.PENDING],
			canceled: counts[REFERRAL_STATUS.CANCELED],
			on_hold: counts[REFERRAL_STATUS.ON_HOLD],
		},
	});
};

/**
 * PDF Doctor Dashboard widgets: "My Referrals, Accepted Referrals, Pending
 * Referral, Completed Referrals".
 */
export const doctorSummary = async (
	request: FastifyRequest<DoctorSummaryRequest>,
	reply: FastifyReply<DoctorSummaryRequest>,
): Promise<void> => {
	const { core } = request.server;

	const where: WhereClause<ReferralModelSelect> = {
		OR: [
			{ doctor: request.user!.id },
			{
				doctor: { isNull: true },
				destination_facility_id: request.user!.facility_id!,
			},
		],
	};

	const dateFilter = buildDateRangeFilter(
		request.query.from,
		request.query.to,
		request.query.tz_offset,
	);
	if (dateFilter) where.created_at = dateFilter;

	const counts = zeroFillCounts(
		await core.referral.count(where, "status"),
		REFERRAL_STATUS,
	);

	const myReferrals = sumCounts(counts);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Doctor dashboard summary retrieved.",
		data: {
			my_referrals: myReferrals,
			accepted: counts[REFERRAL_STATUS.ACCEPTED],
			pending: counts[REFERRAL_STATUS.PENDING],
			completed: counts[REFERRAL_STATUS.COMPLETED],
		},
	});
};

/**
 * PDF Administrator Dashboard widgets: totals plus every referral status.
 */
export const adminSummary = async (
	request: FastifyRequest<AdminSummaryRequest>,
	reply: FastifyReply<AdminSummaryRequest>,
): Promise<void> => {
	const { core } = request.server;

	const where: Record<string, unknown> = {};

	const dateFilter = buildDateRangeFilter(
		request.query.from,
		request.query.to,
		request.query.tz_offset,
	);
	if (dateFilter) where.created_at = dateFilter;

	const [totalUsers, totalPatients, totalFacilities, statusCounts] =
		await Promise.all([
			core.user.count(Object.keys(where).length > 0 ? where : undefined),
			core.patient.count(Object.keys(where).length > 0 ? where : undefined),
			core.facility.count(Object.keys(where).length > 0 ? where : undefined),
			core.referral.count(
				Object.keys(where).length > 0 ? where : undefined,
				"status",
			),
		]);

	const counts = zeroFillCounts(statusCounts, REFERRAL_STATUS);
	const totalReferrals = sumCounts(counts);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Admin dashboard summary retrieved.",
		data: {
			total_users: totalUsers,
			total_patients: totalPatients,
			total_facilities: totalFacilities,
			total_referrals: totalReferrals,
			pending: counts[REFERRAL_STATUS.PENDING],
			accepted: counts[REFERRAL_STATUS.ACCEPTED],
			in_progress: counts[REFERRAL_STATUS.IN_PROGRESS],
			on_hold: counts[REFERRAL_STATUS.ON_HOLD],
			completed: counts[REFERRAL_STATUS.COMPLETED],
			rejected: counts[REFERRAL_STATUS.REJECTED],
			canceled: counts[REFERRAL_STATUS.CANCELED],
		},
	});
};

/**
 * Facility-scoped version of `adminSummary` — a Manager's own staff/
 * patients/referrals (either direction) instead of system-wide totals.
 */
export const managerSummary = async (
	request: FastifyRequest<ManagerSummaryRequest>,
	reply: FastifyReply<ManagerSummaryRequest>,
): Promise<void> => {
	const { core } = request.server;
	const facilityId = request.user!.facility_id!;

	const where: Record<string, unknown> = {};

	const dateFilter = buildDateRangeFilter(
		request.query.from,
		request.query.to,
		request.query.tz_offset,
	);
	if (dateFilter) where.created_at = dateFilter;

	const [
		totalStaff,
		totalPatients,
		statusCounts,
		pendingStaffApplications,
		pendingTransfers,
	] = await Promise.all([
		core.user.count({
			facility_id: facilityId,
			...(Object.keys(where).length > 0 ? where : {}),
		}),
		core.patient.count({
			facility_id: facilityId,
			...(Object.keys(where).length > 0 ? where : {}),
		}),
		core.referral.count(
			{
				OR: [
					{ origin_facility_id: facilityId },
					{ destination_facility_id: facilityId },
				],
				...(Object.keys(where).length > 0 ? where : {}),
			},
			"status",
		),
		core.user.count({
			facility_id: facilityId,
			role: { in: [ROLES.NURSE, ROLES.DOCTOR] },
			status: USER_STATUS.PENDING,
		}),
		new TransferManager(core)
			.getPendingForFacility(facilityId)
			.then((rows) => rows.length),
	]);

	const counts = zeroFillCounts(statusCounts, REFERRAL_STATUS);
	const totalReferrals = sumCounts(counts);

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Manager dashboard summary retrieved.",
		data: {
			total_staff: totalStaff,
			total_patients: totalPatients,
			total_referrals: totalReferrals,
			pending: counts[REFERRAL_STATUS.PENDING],
			accepted: counts[REFERRAL_STATUS.ACCEPTED],
			in_progress: counts[REFERRAL_STATUS.IN_PROGRESS],
			on_hold: counts[REFERRAL_STATUS.ON_HOLD],
			completed: counts[REFERRAL_STATUS.COMPLETED],
			rejected: counts[REFERRAL_STATUS.REJECTED],
			canceled: counts[REFERRAL_STATUS.CANCELED],
			pending_staff_applications: pendingStaffApplications,
			pending_transfers: pendingTransfers,
		},
	});
};
