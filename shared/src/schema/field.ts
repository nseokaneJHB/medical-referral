import { z } from "zod";

import {
	ROLES,
	GENDER,
	HTTP_CODE,
	USER_STATUS,
	ORDER_DIRECTION,
	FACILITY_STATUS,
	TWO_FACTOR_METHOD,
} from "../constant";

import { stringToTitleCase } from "../util";

z.config({
	customError: (issue) => {
		// 1. Get Field Name from Path (Most Reliable for Objects)
		// issue.path is e.g., ["otp"] or ["user", "email"]
		const path = issue.path ?? [];
		const fieldName = path.length > 0 ? String(path[path.length - 1]) : "Field";

		// 2. Handle 'invalid_type' (e.g., required/undefined)
		if (issue.code === "invalid_type") {
			return `${stringToTitleCase(fieldName)} is required.`;
		}

		// Fallback to default message
		return undefined;
	},
});

/**
 * Basic uuid schema.
 * Accepts any non-empty uuid by default; additional refinements applied by derived schemas.
 *
 * Example: "550e8400-e29b-41d4-a716-446655440000"
 */
export const uuidSchema = z.uuid().trim().describe("Basic uuid");

/**
 * Basic string schema.
 * Accepts any non-empty string by default; additional refinements applied by derived schemas.
 *
 * Example: "hello", "Some Title"
 */
export const stringSchema = z.string().trim().describe("Basic string");

/**
 * Basic number schema.
 * Defaults to 0 if no value provided.
 *
 * Example: 0, 42, 3.14
 */
export const numberSchema = z.number().describe("Basic number");

/**
 * Basic integer schema.
 * Defaults to 0 if no value provided.
 *
 * Example: 0, 42
 */
export const integerSchema = z.int().describe("Basic integer");

/**
 * Basic boolean schema.
 * Defaults to false.
 *
 * Example: true, false
 */
export const booleanSchema = z.boolean().describe("Basic boolean");

/**
 * Email schema.
 * Validates RFC-compliant email addresses, trims whitespace and enforces a max length of 255.
 *
 * Example: "user@example.com"
 */
export const emailSchema = z
	.email("Invalid email address")
	.max(255, "Email must not exceed 255 characters")
	.trim()
	.describe("User's email address");

/**
 * User full name schema.
 * - Minimum 3 and maximum 100 characters
 * - Allows letters (including accented), marks, spaces, periods, hyphens and apostrophes
 * - Whitespace is trimmed
 *
 * Example: "Ava O'Connor", "José María"
 */
export const nameSchema = stringSchema
	.min(3, "Name must be at least 3 characters")
	.max(255, "Name must not exceed 255 characters")
	.regex(
		/^[\p{L}\p{M}\s.'-]+$/u,
		"Name must contain only letters, spaces, hyphens, apostrophes, and periods",
	)
	.describe("User's name");

/**
 * Order direction schema
 * Validates order direction for sorting
 *
 * Example: "asc", "desc"
 */
export const orderDirectionSchema = z
	.enum(ORDER_DIRECTION)
	.describe("Order direction for sorting");

/**
 * Standardized HTTP code schema.
 * Validates that the code is one of the predefined HTTP status codes.
 *
 * Example: "OK", "NOT_FOUND", "INTERNAL_SERVER_ERROR"
 */
export const httpCodeSchema = z
	.enum(HTTP_CODE)
	.describe("Standardized response code");

/**
 * Role schema.
 * Enumerates the four roles: Administrator, Manager, Doctor, Nurse.
 *
 * Example: "ADMINISTRATOR", "MANAGER", "DOCTOR", "NURSE"
 */
export const roleSchema = z.enum(ROLES).describe("User's role");

/**
 * User account status schema.
 *
 * Example: "PENDING", "ACTIVE", "REJECTED", "DISABLED", "FLAGGED", "DEPARTED"
 */
export const userStatusSchema = z
	.enum(USER_STATUS)
	.describe("User's account status");

/**
 * Facility status schema — mirrors `userStatusSchema`'s moderation shape.
 *
 * Example: "PENDING", "APPROVED", "REJECTED", "FLAGGED", "SUSPENDED"
 */
export const facilityStatusSchema = z
	.enum(FACILITY_STATUS)
	.describe("Facility's approval/moderation status");

export const genderSchema = z.enum(GENDER).describe("Patient's gender");

export const twoFactorMethodSchema = z
	.enum(TWO_FACTOR_METHOD)
	.describe("Second-factor method");

/** Minimal nested reference to a facility — id + name, for display. */
export const facilityRefSchema = z.object({
	id: uuidSchema,
	name: stringSchema,
});

/** Minimal nested reference to a user — id + name, for display. */
export const userRefSchema = z.object({
	id: uuidSchema,
	name: stringSchema.nullable(),
});

/** Minimal nested reference to a patient — id + name, for display. */
export const patientRefSchema = z.object({
	id: uuidSchema,
	first_name: stringSchema,
	last_name: stringSchema,
});
