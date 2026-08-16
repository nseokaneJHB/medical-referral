import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	API_PATHS,
	CreatePatientSchema,
	UpdatePatientSchema,
	approveActionSchema,
	patientsQuerySchema,
	globalResponseSchema,
	patientParamsSchema,
	transferResponseSchema,
	moderationReasonSchema,
	transferRequestSchema,
	patientResponseSchema,
	patientListResponseSchema,
	patientDetailResponseSchema,
} from "@referral-tracking/shared";

import {
	patient,
	patients,
	patientFlag,
	patientCreate,
	patientUnflag,
	patientUpdate,
} from "./service";
import { transferRequest } from "../transfers/service";

import { EVENT_NAMES } from "../../lib/constant";

/**
 * No `DELETE /:id`, no `ADMINISTRATOR` on any route — Administrator has no
 * individual-record access to Patients at all (see `docs/roles-permissions.md`).
 */
export const route: FastifyPluginAsync = async (
	app: FastifyInstance,
): Promise<void> => {
	app.route({
		method: "POST",
		url: API_PATHS.PATIENT_LIST,
		handler: patientCreate,
		preHandler: [
			app.event(EVENT_NAMES.PATIENT_CREATE),
			app.authenticate,
			app.authorize([ROLES.NURSE]),
		],
		schema: {
			body: CreatePatientSchema,
			response: {
				201: patientResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				422: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.PATIENT_LIST,
		handler: patients,
		preHandler: [
			app.event(EVENT_NAMES.PATIENT_LIST),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR, ROLES.MANAGER]),
		],
		schema: {
			querystring: patientsQuerySchema,
			response: {
				200: patientListResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "GET",
		url: API_PATHS.PATIENT_BY_ID,
		handler: patient,
		preHandler: [
			app.event(EVENT_NAMES.PATIENT_GET),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR, ROLES.MANAGER]),
		],
		schema: {
			params: patientParamsSchema,
			response: {
				200: patientDetailResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.PATIENT_BY_ID,
		handler: patientUpdate,
		preHandler: [
			app.event(EVENT_NAMES.PATIENT_UPDATE),
			app.authenticate,
			app.authorize([ROLES.NURSE]),
		],
		schema: {
			params: patientParamsSchema,
			body: UpdatePatientSchema,
			response: {
				200: patientResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				422: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.PATIENT_FLAG,
		handler: patientFlag,
		preHandler: [
			app.event(EVENT_NAMES.PATIENT_FLAG),
			app.authenticate,
			app.authorize([ROLES.DOCTOR]),
		],
		schema: {
			params: patientParamsSchema,
			body: moderationReasonSchema,
			response: {
				200: patientResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				409: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: API_PATHS.PATIENT_UNFLAG,
		handler: patientUnflag,
		preHandler: [
			app.event(EVENT_NAMES.PATIENT_UNFLAG),
			app.authenticate,
			app.authorize([ROLES.DOCTOR]),
		],
		schema: {
			params: patientParamsSchema,
			body: approveActionSchema,
			response: {
				200: patientResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				409: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "POST",
		url: API_PATHS.PATIENT_TRANSFER_REQUEST,
		handler: transferRequest,
		preHandler: [
			app.event(EVENT_NAMES.PATIENT_TRANSFER_REQUEST),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR]),
		],
		schema: {
			params: patientParamsSchema,
			body: transferRequestSchema,
			response: {
				201: transferResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
				409: globalResponseSchema,
			},
		},
	});
};
