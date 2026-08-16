import { z } from "zod";

import {
	PatientSchema,
	TransferSchema,
	CreatePatientSchema,
	UpdatePatientSchema,
	patientParamsSchema,
	patientsQuerySchema,
	PatientDetailSchema,
	transferParamsSchema,
	patientResponseSchema,
	transferRequestSchema,
	transferResponseSchema,
	patientListResponseSchema,
	transferListResponseSchema,
	patientDetailResponseSchema,
} from "../schema/patient";

export type Patient = z.infer<typeof PatientSchema>;
export type CreatePatientBody = z.infer<typeof CreatePatientSchema>;
export type UpdatePatientBody = z.infer<typeof UpdatePatientSchema>;
export type PatientParams = z.infer<typeof patientParamsSchema>;
export type PatientsQuery = z.infer<typeof patientsQuerySchema>;
export type PatientResponse = z.infer<typeof patientResponseSchema>;
export type PatientListResponse = z.infer<typeof patientListResponseSchema>;
export type PatientDetail = z.infer<typeof PatientDetailSchema>;
export type PatientDetailResponse = z.infer<typeof patientDetailResponseSchema>;

export type Transfer = z.infer<typeof TransferSchema>;
export type TransferRequestBody = z.infer<typeof transferRequestSchema>;
export type TransferParams = z.infer<typeof transferParamsSchema>;
export type TransferResponse = z.infer<typeof transferResponseSchema>;
export type TransferListResponse = z.infer<typeof transferListResponseSchema>;
