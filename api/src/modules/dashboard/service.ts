import type { FastifyReply, FastifyRequest } from "fastify";

import { sql, eq, and, or, inArray, type SQL } from "drizzle-orm";

import {
	ROLES,
	USER_STATUS,
	REFERRAL_STATUS,
	HTTP_RESPONSE_CODE,
} from "@referral-tracking/shared";

import { getPendingTransfersForFacility } from "../../lib/transfer";

import {
	UserModel,
	PatientModel,
	FacilityModel,
	ReferralModel,
} from "../../drizzle/schema";

import type { Database } from "../../core/helpers";

import type {
	NurseSummaryRequest,
	DoctorSummaryRequest,
	AdminSummaryRequest,
	ManagerSummaryRequest,
} from "./type";

/**
 * Grouped `COUNT(*) ... GROUP BY status` for referrals, zero-filled so every
 * status key is always present regardless of whether any rows exist in it.
 */
const countReferralsByStatus = async (
	connection: Database,
	where?: SQL<unknown>,
): Promise<Record<string, number>> => {
	const rows = await connection
		.select({ status: ReferralModel.status, count: sql<number>`count(*)` })
		.from(ReferralModel)
		.where(where)
		.groupBy(ReferralModel.status);

	const counts = Object.fromEntries(
		Object.values(REFERRAL_STATUS).map((status) => [status, 0]),
	);

	for (const row of rows) counts[row.status] = Number(row.count);

	return counts;
};

const totalCount = async (
	connection: Database,
	table: typeof UserModel | typeof PatientModel | typeof FacilityModel,
	where?: SQL<unknown>,
): Promise<number> => {
	const [row] = await connection
		.select({ count: sql<number>`count(*)` })
		.from(table)
		.where(where);

	return Number(row?.count ?? 0);
};

/**
 * PDF Nurse Dashboard widgets: "Referrals Created, Pending Referrals,
 * Canceled Referrals, Referrals on hold".
 */
export const nurseSummary = async (
	request: FastifyRequest<NurseSummaryRequest>,
	reply: FastifyReply<NurseSummaryRequest>,
): Promise<void> => {
	const { connection } = request.server.core;

	const counts = await countReferralsByStatus(
		connection,
		eq(ReferralModel.referrer_id, request.user!.id),
	);

	const referralsCreated = Object.values(counts).reduce((a, b) => a + b, 0);

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
	const { connection } = request.server.core;

	const counts = await countReferralsByStatus(
		connection,
		eq(ReferralModel.doctor, request.user!.id),
	);

	const myReferrals = Object.values(counts).reduce((a, b) => a + b, 0);

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
	const { connection } = request.server.core;

	const [totalUsers, totalPatients, totalFacilities, counts] =
		await Promise.all([
			totalCount(connection, UserModel),
			totalCount(connection, PatientModel),
			totalCount(connection, FacilityModel),
			countReferralsByStatus(connection),
		]);

	const totalReferrals = Object.values(counts).reduce((a, b) => a + b, 0);

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
	const { connection } = core;
	const facilityId = request.user!.facility_id!;

	const referralWhere = or(
		eq(ReferralModel.origin_facility_id, facilityId),
		eq(ReferralModel.destination_facility_id, facilityId),
	);

	const [totalStaff, totalPatients, counts, pendingStaffApplications, pendingTransfers] =
		await Promise.all([
			totalCount(connection, UserModel, eq(UserModel.facility_id, facilityId)),
			totalCount(
				connection,
				PatientModel,
				eq(PatientModel.facility_id, facilityId),
			),
			countReferralsByStatus(connection, referralWhere),
			totalCount(
				connection,
				UserModel,
				and(
					eq(UserModel.facility_id, facilityId),
					inArray(UserModel.role, [ROLES.NURSE, ROLES.DOCTOR]),
					eq(UserModel.status, USER_STATUS.PENDING),
				),
			),
			getPendingTransfersForFacility(core, facilityId).then(
				(rows) => rows.length,
			),
		]);

	const totalReferrals = Object.values(counts).reduce((a, b) => a + b, 0);

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
