import { z } from "zod";

import {
	patientSchema,
	transferSchema,
	createPatientSchema,
	updatePatientSchema,
	patientParamsSchema,
	patientsQuerySchema,
	patientDetailSchema,
	transferParamsSchema,
	patientResponseSchema,
	transferRequestSchema,
	transferResponseSchema,
	patientListResponseSchema,
	transferListResponseSchema,
	patientDetailResponseSchema,
} from "../schema/patient";

export type Patient = z.infer<typeof patientSchema>;
export type CreatePatientBody = z.infer<typeof createPatientSchema>;
export type UpdatePatientBody = z.infer<typeof updatePatientSchema>;
export type PatientParams = z.infer<typeof patientParamsSchema>;
export type PatientsQuery = z.infer<typeof patientsQuerySchema>;
export type PatientResponse = z.infer<typeof patientResponseSchema>;
export type PatientListResponse = z.infer<typeof patientListResponseSchema>;
export type PatientDetail = z.infer<typeof patientDetailSchema>;
export type PatientDetailResponse = z.infer<typeof patientDetailResponseSchema>;

export type Transfer = z.infer<typeof transferSchema>;
export type TransferRequestBody = z.infer<typeof transferRequestSchema>;
export type TransferParams = z.infer<typeof transferParamsSchema>;
export type TransferResponse = z.infer<typeof transferResponseSchema>;
export type TransferListResponse = z.infer<typeof transferListResponseSchema>;
