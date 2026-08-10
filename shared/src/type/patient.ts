import { z } from "zod";

import {
	PatientSchema,
	CreatePatientSchema,
	UpdatePatientSchema,
	patientParamsSchema,
	patientsQuerySchema,
	patientResponseSchema,
	patientListResponseSchema,
} from "../schema/patient";

export type Patient = z.infer<typeof PatientSchema>;
export type CreatePatientBody = z.infer<typeof CreatePatientSchema>;
export type UpdatePatientBody = z.infer<typeof UpdatePatientSchema>;
export type PatientParams = z.infer<typeof patientParamsSchema>;
export type PatientsQuery = z.infer<typeof patientsQuerySchema>;
export type PatientResponse = z.infer<typeof patientResponseSchema>;
export type PatientListResponse = z.infer<typeof patientListResponseSchema>;
