import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
	ROLES,
	CreatePatientSchema,
	UpdatePatientSchema,
	patientsQuerySchema,
	globalResponseSchema,
	patientParamsSchema,
	patientResponseSchema,
	patientListResponseSchema,
} from "@referral-tracking/shared";

import { patient, patients, patientCreate, patientUpdate } from "./service";

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
		url: "/",
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
		url: "/",
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
		url: "/:id",
		handler: patient,
		preHandler: [
			app.event(EVENT_NAMES.PATIENT_GET),
			app.authenticate,
			app.authorize([ROLES.NURSE, ROLES.DOCTOR, ROLES.MANAGER]),
		],
		schema: {
			params: patientParamsSchema,
			response: {
				200: patientResponseSchema,
				401: globalResponseSchema,
				403: globalResponseSchema,
				404: globalResponseSchema,
			},
		},
	});

	app.route({
		method: "PATCH",
		url: "/:id",
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
};
