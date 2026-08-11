import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	USER_STATUS,
	REFERRAL_STATUS,
	HTTP_RESPONSE_CODE,
} from "@referral-tracking/shared";

import { zeroFillCounts } from "../../lib/util";
import { getPendingTransfersForFacility } from "../../lib/transfer";

import type {
	NurseSummaryRequest,
	DoctorSummaryRequest,
	AdminSummaryRequest,
	ManagerSummaryRequest,
} from "./type";

/**
 * PDF Nurse Dashboard widgets: "Referrals Created, Pending Referrals,
 * Canceled Referrals, Referrals on hold".
 */
export const nurseSummary = async (
	request: FastifyRequest<NurseSummaryRequest>,
	reply: FastifyReply<NurseSummaryRequest>,
): Promise<void> => {
	const { core } = request.server;

	const counts = zeroFillCounts(
		await core.referral.count({ referrer_id: request.user!.id }, "status"),
		REFERRAL_STATUS,
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
	const { core } = request.server;

	const counts = zeroFillCounts(
		await core.referral.count({ doctor: request.user!.id }, "status"),
		REFERRAL_STATUS,
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
	const { core } = request.server;

	const [totalUsers, totalPatients, totalFacilities, statusCounts] =
		await Promise.all([
			core.user.count(),
			core.patient.count(),
			core.facility.count(),
			core.referral.count(undefined, "status"),
		]);

	const counts = zeroFillCounts(statusCounts, REFERRAL_STATUS);
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
	const facilityId = request.user!.facility_id!;

	const [totalStaff, totalPatients, statusCounts, pendingStaffApplications, pendingTransfers] =
		await Promise.all([
			core.user.count({ facility_id: facilityId }),
			core.patient.count({ facility_id: facilityId }),
			core.referral.count(
				{
					OR: [
						{ origin_facility_id: facilityId },
						{ destination_facility_id: facilityId },
					],
				},
				"status",
			),
			core.user.count({
				facility_id: facilityId,
				role: { in: [ROLES.NURSE, ROLES.DOCTOR] },
				status: USER_STATUS.PENDING,
			}),
			getPendingTransfersForFacility(core, facilityId).then(
				(rows) => rows.length,
			),
		]);

	const counts = zeroFillCounts(statusCounts, REFERRAL_STATUS);
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
