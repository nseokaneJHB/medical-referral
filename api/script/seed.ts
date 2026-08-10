import { eq } from "drizzle-orm";
import { faker } from "@faker-js/faker";

import {
	ROLES,
	GENDER,
	PRIORITY,
	LOGIN_STATUS,
	USER_STATUS,
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	REFERRAL_STATUS,
	FACILITY_STATUS,
	STATUS_TRANSITIONS,
	DOCTOR_STATUS_TARGETS_BY_STATUS,
	type Role,
	type UserStatus,
	type FacilityStatus,
	type ReferralStatus,
} from "@referral-tracking/shared";

import { auth } from "../src/lib/auth";
import { generateUuid } from "../src/lib/util";
import { client, connection } from "../src/lib/database";

import {
	UserModel,
	PatientModel,
	LoginsModel,
	ReferralModel,
	TimelineModel,
	FacilityModel,
	SpecialtyModel,
	UserSpecialtyModel,
	FacilitySpecialtyModel,
	type PatientModelInsert,
	type ReferralModelInsert,
	type TimelineModelInsert,
	type FacilityModelInsert,
	type SpecialtyModelInsert,
	type LoginsModelInsert,
	type UserSpecialtyModelInsert,
	type FacilitySpecialtyModelInsert,
} from "../src/drizzle/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date();
const YEAR_AGO = new Date(NOW.getTime() - 365 * DAY_MS);

const STANDARD_PASSWORD = "Password@123";

const daysAfter = (date: Date, days: number): Date =>
	new Date(date.getTime() + days * DAY_MS);

const randomBetween = (from: Date, to: Date = NOW): Date =>
	faker.date.between({ from, to: to > from ? to : daysAfter(from, 1) });

const chunk = <T>(items: T[], size: number): T[][] => {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size)
		chunks.push(items.slice(i, i + size));
	return chunks;
};

const SPECIALTY_NAMES = [
	"Cardiology",
	"Orthopedics",
	"Pediatrics",
	"Neurology",
	"Oncology",
	"Radiology",
	"General Surgery",
	"Internal Medicine",
	"Emergency Medicine",
	"Psychiatry",
	"Obstetrics & Gynecology",
	"Dermatology",
];

const FACILITY_NAME_SUFFIXES = [
	"General Hospital",
	"Medical Center",
	"Community Clinic",
	"Regional Hospital",
	"Health Center",
	"Memorial Hospital",
];

const VISIT_REASON_NOTES = [
	"Hypertension, managed with daily medication.",
	"Type 2 diabetes, diet-controlled.",
	"Seasonal asthma, uses inhaler as needed.",
	"History of lower back pain following a workplace injury.",
	"No significant past medical history.",
	"Mild anxiety, previously prescribed short-term medication.",
	"Family history of cardiovascular disease.",
	"Recovering from an appendectomy performed two years ago.",
	"Chronic migraines, tracked with a headache diary.",
	"Allergic to penicillin.",
	"Osteoarthritis in both knees, referred for pain management.",
	"Recently diagnosed with hypothyroidism.",
];

const referralReasonTemplates = (specialty: string): string[] => [
	`Referred for ${specialty} evaluation following persistent symptoms.`,
	`Requesting ${specialty} consultation to confirm diagnosis and treatment plan.`,
	`Patient needs specialist ${specialty} input beyond current facility's capacity.`,
	`Follow-up ${specialty} care recommended after recent test results.`,
	`Escalating to ${specialty} for further assessment and management.`,
];

const FAILED_LOGIN_REASONS = [
	"Invalid email or password.",
	"Invalid email or password.",
	"Invalid email or password.",
	"Too many attempts, please try again later.",
];

const REJECTION_REASONS = [
	"Credentials could not be verified against the licensing board.",
	"Incomplete application — missing required documentation.",
	"Facility already has sufficient staffing in this role.",
];
const DISABLE_REASONS = [
	"Repeated violations of facility conduct policy.",
	"Extended unexplained absence from duty.",
	"Failed mandatory compliance training.",
];
const FLAG_REASONS_USER = [
	"Pending investigation into a patient complaint.",
	"Irregularities noted in recent referral documentation.",
];
const FACILITY_FLAG_REASONS = [
	"Under review following a compliance complaint.",
	"Irregular billing patterns flagged for investigation.",
];
const FACILITY_SUSPEND_REASONS = [
	"Failed a routine licensing inspection.",
	"Confirmed violation of patient data handling policy.",
];
const FACILITY_REJECT_REASONS = [
	"Unable to verify facility licensing documentation.",
	"Duplicate registration for an existing facility.",
];

interface FacilityDef {
	id: string;
	name: string;
	address: string;
	status: FacilityStatus;
	registeredAt: Date;
	decidedAt: Date;
	incidentAt?: Date;
}

interface UserDef {
	name: string;
	email: string;
	password: string;
	role: Role;
	facilityId: string | null;
	targetStatus: UserStatus;
	joinedAt: Date;
	tag?: string;
}

interface CreatedUser {
	id: string;
	email: string;
	role: Role;
	facilityId: string | null;
	targetStatus: UserStatus;
	joinedAt: Date;
	tag?: string;
}

interface PatientLite {
	id: string;
	created_at: Date;
}

const randomFacilityName = (): string =>
	`${faker.location.city()} ${faker.helpers.arrayElement(FACILITY_NAME_SUFFIXES)}`;

async function main(): Promise<void> {
	console.log("🌱 Seeding a year of realistic usage data...");

	// ---------- Specialties ----------
	const specialtyRows: SpecialtyModelInsert[] = SPECIALTY_NAMES.map((name) => ({
		id: generateUuid(),
		name,
	}));
	await connection.insert(SpecialtyModel).values(specialtyRows);
	console.log(`✓ ${specialtyRows.length} specialties`);

	// ---------- Facilities ----------
	// 6 approved (founded early in the year), 1 pending (applied recently),
	// 1 rejected, 1 flagged (approved, later flagged), 1 suspended
	// (approved, later suspended) — full status coverage.
	const facilityDefs: FacilityDef[] = [];

	for (let i = 0; i < 6; i++) {
		const registeredAt = randomBetween(YEAR_AGO, daysAfter(YEAR_AGO, 60));
		facilityDefs.push({
			id: generateUuid(),
			name: randomFacilityName(),
			address: faker.location.streetAddress(true),
			status: FACILITY_STATUS.APPROVED,
			registeredAt,
			decidedAt: daysAfter(registeredAt, faker.number.int({ min: 1, max: 5 })),
		});
	}

	{
		const registeredAt = randomBetween(daysAfter(NOW, -20), NOW);
		facilityDefs.push({
			id: generateUuid(),
			name: randomFacilityName(),
			address: faker.location.streetAddress(true),
			status: FACILITY_STATUS.PENDING,
			registeredAt,
			decidedAt: registeredAt,
		});
	}

	{
		const registeredAt = randomBetween(YEAR_AGO, daysAfter(NOW, -30));
		facilityDefs.push({
			id: generateUuid(),
			name: randomFacilityName(),
			address: faker.location.streetAddress(true),
			status: FACILITY_STATUS.REJECTED,
			registeredAt,
			decidedAt: daysAfter(registeredAt, faker.number.int({ min: 2, max: 10 })),
		});
	}

	for (const status of [
		FACILITY_STATUS.FLAGGED,
		FACILITY_STATUS.SUSPENDED,
	] as const) {
		const registeredAt = randomBetween(YEAR_AGO, daysAfter(YEAR_AGO, 90));
		const decidedAt = daysAfter(
			registeredAt,
			faker.number.int({ min: 1, max: 5 }),
		);
		facilityDefs.push({
			id: generateUuid(),
			name: randomFacilityName(),
			address: faker.location.streetAddress(true),
			status,
			registeredAt,
			decidedAt,
			incidentAt: randomBetween(daysAfter(decidedAt, 30), NOW),
		});
	}

	const facilityRows: FacilityModelInsert[] = facilityDefs.map((def) => ({
		id: def.id,
		name: def.name,
		address: def.address,
		status: def.status,
		created_at: def.registeredAt,
		updated_at: def.incidentAt ?? def.decidedAt,
	}));
	await connection.insert(FacilityModel).values(facilityRows);
	console.log(`✓ ${facilityDefs.length} facilities`);

	const approvedFacilities = facilityDefs.filter(
		(f) => f.status === FACILITY_STATUS.APPROVED,
	);
	const operationalFacilities = facilityDefs.filter(
		(f) =>
			f.status === FACILITY_STATUS.APPROVED ||
			f.status === FACILITY_STATUS.FLAGGED ||
			f.status === FACILITY_STATUS.SUSPENDED,
	);
	const pendingFacility = facilityDefs.find(
		(f) => f.status === FACILITY_STATUS.PENDING,
	) as FacilityDef;
	const rejectedFacility = facilityDefs.find(
		(f) => f.status === FACILITY_STATUS.REJECTED,
	) as FacilityDef;
	const flaggedFacility = facilityDefs.find(
		(f) => f.status === FACILITY_STATUS.FLAGGED,
	) as FacilityDef;
	const suspendedFacility = facilityDefs.find(
		(f) => f.status === FACILITY_STATUS.SUSPENDED,
	) as FacilityDef;

	// ---------- Facility specialties ----------
	const facilitySpecialtyRows: FacilitySpecialtyModelInsert[] = [];
	const facilitySpecialtyMap = new Map<string, SpecialtyModelInsert[]>();
	for (const facility of operationalFacilities) {
		const picks = faker.helpers.arrayElements(specialtyRows, {
			min: 2,
			max: 4,
		});
		facilitySpecialtyMap.set(facility.id, picks);
		for (const specialty of picks) {
			facilitySpecialtyRows.push({
				id: generateUuid(),
				facility_id: facility.id,
				specialty_id: specialty.id,
				created_at: facility.registeredAt,
			});
		}
	}
	await connection.insert(FacilitySpecialtyModel).values(facilitySpecialtyRows);
	console.log(`✓ ${facilitySpecialtyRows.length} facility specialty links`);

	// ---------- Users ----------
	const usedEmails = new Set<string>([
		"administrator@gmail.com",
		"manager@gmail.com",
		"nurse@gmail.com",
		"doctor@gmail.com",
	]);
	const uniqueEmail = (firstName: string, lastName: string): string => {
		let email = faker.internet.email({ firstName, lastName }).toLowerCase();
		while (usedEmails.has(email)) {
			email = faker.internet
				.email({
					firstName,
					lastName,
					provider: `${faker.string.alphanumeric(6)}.com`,
				})
				.toLowerCase();
		}
		usedEmails.add(email);
		return email;
	};

	const userDefs: UserDef[] = [
		{
			name: "Ava Administrator",
			email: "administrator@gmail.com",
			password: STANDARD_PASSWORD,
			role: ROLES.ADMINISTRATOR,
			facilityId: null,
			targetStatus: USER_STATUS.ACTIVE,
			joinedAt: YEAR_AGO,
		},
		{
			name: "Frank Manager",
			email: "manager@gmail.com",
			password: STANDARD_PASSWORD,
			role: ROLES.MANAGER,
			facilityId: approvedFacilities[0].id,
			targetStatus: USER_STATUS.ACTIVE,
			joinedAt: approvedFacilities[0].registeredAt,
		},
		{
			name: "Nia Nurse",
			email: "nurse@gmail.com",
			password: STANDARD_PASSWORD,
			role: ROLES.NURSE,
			facilityId: approvedFacilities[0].id,
			targetStatus: USER_STATUS.ACTIVE,
			joinedAt: daysAfter(approvedFacilities[0].registeredAt, 3),
		},
		{
			name: "Derek Doctor",
			email: "doctor@gmail.com",
			password: STANDARD_PASSWORD,
			role: ROLES.DOCTOR,
			facilityId: approvedFacilities[0].id,
			targetStatus: USER_STATUS.ACTIVE,
			joinedAt: daysAfter(approvedFacilities[0].registeredAt, 3),
		},
	];

	const pushStaff = (
		role: Role,
		facilityId: string | null,
		targetStatus: UserStatus,
		joinedAt: Date,
		tag?: string,
	): void => {
		const name = faker.person.fullName();
		const [first, ...rest] = name.split(" ");
		const last = rest.join(" ") || first;
		userDefs.push({
			name,
			email: uniqueEmail(first, last),
			password: faker.internet.password({ length: 14 }),
			role,
			facilityId,
			targetStatus,
			joinedAt,
			tag,
		});
	};

	// Extra administrator (accounts an admin vouches for directly).
	pushStaff(
		ROLES.ADMINISTRATOR,
		null,
		USER_STATUS.ACTIVE,
		randomBetween(YEAR_AGO, daysAfter(YEAR_AGO, 120)),
	);

	// Staffing for every approved facility (facility[0] already has its
	// standard manager/nurse/doctor above — top it up for volume too).
	for (const facility of approvedFacilities) {
		if (facility.id !== approvedFacilities[0].id) {
			pushStaff(
				ROLES.MANAGER,
				facility.id,
				USER_STATUS.ACTIVE,
				facility.registeredAt,
			);
		}

		const nurseCount = faker.number.int({ min: 2, max: 4 });
		for (let i = 0; i < nurseCount; i++) {
			pushStaff(
				ROLES.NURSE,
				facility.id,
				USER_STATUS.ACTIVE,
				randomBetween(
					facility.registeredAt,
					daysAfter(facility.registeredAt, 200),
				),
			);
		}

		const doctorCount = faker.number.int({ min: 2, max: 3 });
		for (let i = 0; i < doctorCount; i++) {
			pushStaff(
				ROLES.DOCTOR,
				facility.id,
				USER_STATUS.ACTIVE,
				randomBetween(
					facility.registeredAt,
					daysAfter(facility.registeredAt, 200),
				),
			);
		}
	}

	// Flagged/suspended facilities were operational before the incident —
	// they still have real staff.
	for (const facility of [flaggedFacility, suspendedFacility]) {
		pushStaff(
			ROLES.MANAGER,
			facility.id,
			USER_STATUS.ACTIVE,
			facility.registeredAt,
		);
		pushStaff(
			ROLES.NURSE,
			facility.id,
			USER_STATUS.ACTIVE,
			daysAfter(facility.registeredAt, 5),
		);
		pushStaff(
			ROLES.NURSE,
			facility.id,
			USER_STATUS.ACTIVE,
			daysAfter(facility.registeredAt, 10),
		);
		pushStaff(
			ROLES.DOCTOR,
			facility.id,
			USER_STATUS.ACTIVE,
			daysAfter(facility.registeredAt, 7),
		);
	}

	// Founding managers of the pending/rejected facilities.
	pushStaff(
		ROLES.MANAGER,
		pendingFacility.id,
		USER_STATUS.PENDING,
		pendingFacility.registeredAt,
	);
	pushStaff(
		ROLES.MANAGER,
		rejectedFacility.id,
		USER_STATUS.REJECTED,
		rejectedFacility.registeredAt,
	);

	// Scattered status variety at random approved facilities — turned-down
	// applicants, disabled staff, a couple of still-pending applications,
	// and a departed manager predecessor.
	for (let i = 0; i < 3; i++) {
		const facility = faker.helpers.arrayElement(approvedFacilities);
		pushStaff(
			faker.helpers.arrayElement([ROLES.NURSE, ROLES.DOCTOR]),
			facility.id,
			USER_STATUS.REJECTED,
			randomBetween(daysAfter(facility.registeredAt, 30), NOW),
		);
	}

	for (let i = 0; i < 2; i++) {
		const facility = faker.helpers.arrayElement(approvedFacilities);
		pushStaff(
			faker.helpers.arrayElement([ROLES.NURSE, ROLES.DOCTOR]),
			facility.id,
			USER_STATUS.DISABLED,
			randomBetween(facility.registeredAt, daysAfter(NOW, -60)),
		);
	}

	for (let i = 0; i < 2; i++) {
		const facility = faker.helpers.arrayElement(approvedFacilities);
		pushStaff(
			faker.helpers.arrayElement([ROLES.NURSE, ROLES.DOCTOR]),
			facility.id,
			USER_STATUS.PENDING,
			randomBetween(daysAfter(NOW, -14), NOW),
		);
	}

	pushStaff(
		ROLES.MANAGER,
		approvedFacilities[1].id,
		USER_STATUS.DEPARTED,
		approvedFacilities[1].registeredAt,
	);

	// Three tagged appeal scenarios — one approved (reinstated), two denied.
	pushStaff(
		ROLES.DOCTOR,
		approvedFacilities[2].id,
		USER_STATUS.FLAGGED,
		daysAfter(approvedFacilities[2].registeredAt, 20),
		"appeal-flagged-approved",
	);
	pushStaff(
		ROLES.NURSE,
		approvedFacilities[3].id,
		USER_STATUS.REJECTED,
		randomBetween(daysAfter(NOW, -180), daysAfter(NOW, -120)),
		"appeal-rejected-denied",
	);
	pushStaff(
		ROLES.NURSE,
		approvedFacilities[4].id,
		USER_STATUS.DISABLED,
		randomBetween(daysAfter(NOW, -150), daysAfter(NOW, -90)),
		"appeal-disabled-denied",
	);

	const createdUsers: CreatedUser[] = [];
	for (const def of userDefs) {
		try {
			const created = await auth.api.signUpEmail({
				body: {
					name: def.name,
					email: def.email,
					password: def.password,
					role: def.role,
					facility_id: def.facilityId ?? undefined,
				},
			});
			createdUsers.push({
				id: created.user.id,
				email: def.email,
				role: def.role,
				facilityId: def.facilityId,
				targetStatus: def.targetStatus,
				joinedAt: def.joinedAt,
				tag: def.tag,
			});
		} catch (error) {
			console.log(`↷ ${def.email} failed to create, skipping (${error})`);
		}
	}
	console.log(`✓ ${createdUsers.length} users created`);

	const rootAdmin = createdUsers.find(
		(u) => u.email === "administrator@gmail.com",
	);
	if (!rootAdmin)
		throw new Error("Failed to create the root administrator — aborting seed.");

	for (const u of createdUsers) {
		const finalStatus =
			u.tag === "appeal-flagged-approved" ? USER_STATUS.ACTIVE : u.targetStatus;
		await connection
			.update(UserModel)
			.set({ status: finalStatus, created_at: u.joinedAt })
			.where(eq(UserModel.id, u.id));
	}
	console.log("✓ user statuses/join dates patched");

	const facilityManagerId = new Map<string, string>();
	for (const u of createdUsers) {
		if (
			u.role === ROLES.MANAGER &&
			u.targetStatus === USER_STATUS.ACTIVE &&
			u.facilityId
		) {
			facilityManagerId.set(u.facilityId, u.id);
		}
	}

	// ---------- Timeline: user + facility lifecycle ----------
	const timelineRows: TimelineModelInsert[] = [];

	for (const u of createdUsers) {
		if (u.role === ROLES.ADMINISTRATOR) continue; // bootstrapped/vouched-for, not approved via the flow
		if (u.targetStatus === USER_STATUS.PENDING) continue; // no decision made yet

		const approverId =
			u.role === ROLES.MANAGER
				? rootAdmin.id
				: (u.facilityId && facilityManagerId.get(u.facilityId)) || rootAdmin.id;
		const approvedAt = daysAfter(
			u.joinedAt,
			faker.number.int({ min: 1, max: 4 }),
		);

		if (u.targetStatus === USER_STATUS.REJECTED) {
			timelineRows.push({
				id: generateUuid(),
				type: TIMELINE_TYPE.USER,
				entity: u.id,
				action: TIMELINE_ACTION.REJECTED,
				previous: USER_STATUS.PENDING,
				next: USER_STATUS.REJECTED,
				changer_id: approverId,
				notes: faker.helpers.arrayElement(REJECTION_REASONS),
				changed_at: approvedAt,
			});

			if (u.tag === "appeal-rejected-denied") {
				const appealAt = daysAfter(
					approvedAt,
					faker.number.int({ min: 5, max: 15 }),
				);
				timelineRows.push(
					{
						id: generateUuid(),
						type: TIMELINE_TYPE.USER,
						entity: u.id,
						action: TIMELINE_ACTION.APPEAL_SUBMITTED,
						previous: null,
						next: null,
						changer_id: u.id,
						notes:
							"I believe this decision was made in error and would like it reconsidered.",
						changed_at: appealAt,
					},
					{
						id: generateUuid(),
						type: TIMELINE_TYPE.USER,
						entity: u.id,
						action: TIMELINE_ACTION.APPEAL_DENIED,
						previous: USER_STATUS.REJECTED,
						next: USER_STATUS.REJECTED,
						changer_id: rootAdmin.id,
						notes: "Original decision upheld after review.",
						changed_at: daysAfter(
							appealAt,
							faker.number.int({ min: 3, max: 10 }),
						),
					},
				);
			}
			continue;
		}

		timelineRows.push({
			id: generateUuid(),
			type: TIMELINE_TYPE.USER,
			entity: u.id,
			action: TIMELINE_ACTION.APPROVED,
			previous: USER_STATUS.PENDING,
			next: USER_STATUS.ACTIVE,
			changer_id: approverId,
			notes: null,
			changed_at: approvedAt,
		});

		if (u.targetStatus === USER_STATUS.DISABLED) {
			const disabledAt = randomBetween(daysAfter(approvedAt, 20), NOW);
			timelineRows.push({
				id: generateUuid(),
				type: TIMELINE_TYPE.USER,
				entity: u.id,
				action: TIMELINE_ACTION.DISABLED,
				previous: USER_STATUS.ACTIVE,
				next: USER_STATUS.DISABLED,
				changer_id: rootAdmin.id,
				notes: faker.helpers.arrayElement(DISABLE_REASONS),
				changed_at: disabledAt,
			});

			if (u.tag === "appeal-disabled-denied") {
				const appealAt = daysAfter(
					disabledAt,
					faker.number.int({ min: 4, max: 12 }),
				);
				timelineRows.push(
					{
						id: generateUuid(),
						type: TIMELINE_TYPE.USER,
						entity: u.id,
						action: TIMELINE_ACTION.APPEAL_SUBMITTED,
						previous: null,
						next: null,
						changer_id: u.id,
						notes:
							"Requesting reinstatement — I've addressed the concerns raised.",
						changed_at: appealAt,
					},
					{
						id: generateUuid(),
						type: TIMELINE_TYPE.USER,
						entity: u.id,
						action: TIMELINE_ACTION.APPEAL_DENIED,
						previous: USER_STATUS.DISABLED,
						next: USER_STATUS.DISABLED,
						changer_id: rootAdmin.id,
						notes: "Not enough evidence provided to reverse the decision.",
						changed_at: daysAfter(
							appealAt,
							faker.number.int({ min: 3, max: 8 }),
						),
					},
				);
			}
		}

		if (u.targetStatus === USER_STATUS.FLAGGED) {
			const flaggedAt = randomBetween(daysAfter(approvedAt, 20), NOW);
			timelineRows.push({
				id: generateUuid(),
				type: TIMELINE_TYPE.USER,
				entity: u.id,
				action: TIMELINE_ACTION.FLAGGED,
				previous: USER_STATUS.ACTIVE,
				next: USER_STATUS.FLAGGED,
				changer_id: rootAdmin.id,
				notes: faker.helpers.arrayElement(FLAG_REASONS_USER),
				changed_at: flaggedAt,
			});

			if (u.tag === "appeal-flagged-approved") {
				const appealAt = daysAfter(
					flaggedAt,
					faker.number.int({ min: 3, max: 10 }),
				);
				timelineRows.push(
					{
						id: generateUuid(),
						type: TIMELINE_TYPE.USER,
						entity: u.id,
						action: TIMELINE_ACTION.APPEAL_SUBMITTED,
						previous: null,
						next: null,
						changer_id: u.id,
						notes:
							"The investigation found no wrongdoing on my part — requesting reinstatement.",
						changed_at: appealAt,
					},
					{
						id: generateUuid(),
						type: TIMELINE_TYPE.USER,
						entity: u.id,
						action: TIMELINE_ACTION.APPEAL_APPROVED,
						previous: USER_STATUS.FLAGGED,
						next: USER_STATUS.ACTIVE,
						changer_id: rootAdmin.id,
						notes:
							"Investigation concluded, no policy violation found. Reinstated.",
						changed_at: daysAfter(
							appealAt,
							faker.number.int({ min: 3, max: 8 }),
						),
					},
				);
			}
		}

		if (u.targetStatus === USER_STATUS.DEPARTED) {
			timelineRows.push({
				id: generateUuid(),
				type: TIMELINE_TYPE.USER,
				entity: u.id,
				action: TIMELINE_ACTION.DEPARTED,
				previous: USER_STATUS.ACTIVE,
				next: USER_STATUS.DEPARTED,
				changer_id: u.id,
				notes: "Voluntary departure — accepted a position elsewhere.",
				changed_at: randomBetween(
					daysAfter(approvedAt, 60),
					daysAfter(NOW, -30),
				),
			});
		}
	}

	for (const facility of facilityDefs) {
		if (facility.status === FACILITY_STATUS.PENDING) continue;

		if (facility.status === FACILITY_STATUS.REJECTED) {
			timelineRows.push({
				id: generateUuid(),
				type: TIMELINE_TYPE.FACILITY,
				entity: facility.id,
				action: TIMELINE_ACTION.REJECTED,
				previous: FACILITY_STATUS.PENDING,
				next: FACILITY_STATUS.REJECTED,
				changer_id: rootAdmin.id,
				notes: faker.helpers.arrayElement(FACILITY_REJECT_REASONS),
				changed_at: facility.decidedAt,
			});
			continue;
		}

		timelineRows.push({
			id: generateUuid(),
			type: TIMELINE_TYPE.FACILITY,
			entity: facility.id,
			action: TIMELINE_ACTION.APPROVED,
			previous: FACILITY_STATUS.PENDING,
			next: FACILITY_STATUS.APPROVED,
			changer_id: rootAdmin.id,
			notes: null,
			changed_at: facility.decidedAt,
		});

		if (facility.status === FACILITY_STATUS.FLAGGED) {
			timelineRows.push({
				id: generateUuid(),
				type: TIMELINE_TYPE.FACILITY,
				entity: facility.id,
				action: TIMELINE_ACTION.FLAGGED,
				previous: FACILITY_STATUS.APPROVED,
				next: FACILITY_STATUS.FLAGGED,
				changer_id: rootAdmin.id,
				notes: faker.helpers.arrayElement(FACILITY_FLAG_REASONS),
				changed_at: facility.incidentAt as Date,
			});
		}

		if (facility.status === FACILITY_STATUS.SUSPENDED) {
			timelineRows.push({
				id: generateUuid(),
				type: TIMELINE_TYPE.FACILITY,
				entity: facility.id,
				action: TIMELINE_ACTION.SUSPENDED,
				previous: FACILITY_STATUS.APPROVED,
				next: FACILITY_STATUS.SUSPENDED,
				changer_id: rootAdmin.id,
				notes: faker.helpers.arrayElement(FACILITY_SUSPEND_REASONS),
				changed_at: facility.incidentAt as Date,
			});
		}
	}

	// ---------- User specialties ----------
	const activeClinicalByFacility = new Map<string, CreatedUser[]>();
	for (const u of createdUsers) {
		const isClinical = u.role === ROLES.NURSE || u.role === ROLES.DOCTOR;
		const isActive =
			u.targetStatus === USER_STATUS.ACTIVE ||
			u.tag === "appeal-flagged-approved";
		if (!isClinical || !isActive || !u.facilityId) continue;
		const list = activeClinicalByFacility.get(u.facilityId) ?? [];
		list.push(u);
		activeClinicalByFacility.set(u.facilityId, list);
	}

	const userSpecialtyRows: UserSpecialtyModelInsert[] = [];
	for (const [facilityId, staff] of activeClinicalByFacility) {
		const pool = facilitySpecialtyMap.get(facilityId) ?? specialtyRows;
		for (const member of staff) {
			const picks = faker.helpers.arrayElements(pool, { min: 1, max: 2 });
			for (const specialty of picks) {
				userSpecialtyRows.push({
					id: generateUuid(),
					user_id: member.id,
					specialty_id: specialty.id,
					created_at: daysAfter(member.joinedAt, 1),
				});
			}
		}
	}
	await connection.insert(UserSpecialtyModel).values(userSpecialtyRows);
	console.log(`✓ ${userSpecialtyRows.length} user specialty links`);

	// ---------- Patients ----------
	const eligibleFacilities = operationalFacilities.filter(
		(f) => (activeClinicalByFacility.get(f.id) ?? []).length > 0,
	);

	const PATIENT_COUNT = 200;
	const patientRows: PatientModelInsert[] = [];
	const patientsByFacility = new Map<string, PatientLite[]>();

	for (let i = 0; i < PATIENT_COUNT; i++) {
		const facility = faker.helpers.arrayElement(eligibleFacilities);
		const staffPool = activeClinicalByFacility.get(
			facility.id,
		) as CreatedUser[];
		const creator = faker.helpers.arrayElement(staffPool);

		const earliestPossible =
			creator.joinedAt > facility.registeredAt
				? creator.joinedAt
				: facility.registeredAt;
		const createdAt = randomBetween(earliestPossible, NOW);
		const patientId = generateUuid();

		patientRows.push({
			id: patientId,
			first_name: faker.person.firstName(),
			last_name: faker.person.lastName(),
			date_of_birth: faker.date
				.birthdate({ min: 0, max: 95, mode: "age" })
				.toISOString()
				.slice(0, 10),
			gender: faker.helpers.arrayElement(Object.values(GENDER)),
			phone: faker.phone.number().slice(0, 20),
			address: faker.location.streetAddress(true),
			creator_id: creator.id,
			facility_id: facility.id,
			created_at: createdAt,
			updated_at: createdAt,
		});

		const list = patientsByFacility.get(facility.id) ?? [];
		list.push({ id: patientId, created_at: createdAt });
		patientsByFacility.set(facility.id, list);
	}

	for (const batch of chunk(patientRows, 200)) {
		await connection.insert(PatientModel).values(batch);
	}
	console.log(`✓ ${patientRows.length} patients`);

	// ---------- Referrals ----------
	// Biases the random walk toward positive outcomes — a real referral
	// system resolves accepted/completed far more often than rejected/
	// canceled. `STATUS_TRANSITIONS` still governs which moves are legal.
	const TRANSITION_WEIGHTS: Partial<
		Record<ReferralStatus, Partial<Record<ReferralStatus, number>>>
	> = {
		[REFERRAL_STATUS.PENDING]: {
			[REFERRAL_STATUS.ACCEPTED]: 55,
			[REFERRAL_STATUS.ON_HOLD]: 20,
			[REFERRAL_STATUS.REJECTED]: 15,
			[REFERRAL_STATUS.CANCELED]: 10,
		},
		[REFERRAL_STATUS.ACCEPTED]: {
			[REFERRAL_STATUS.IN_PROGRESS]: 65,
			[REFERRAL_STATUS.ON_HOLD]: 20,
			[REFERRAL_STATUS.REJECTED]: 15,
		},
		[REFERRAL_STATUS.IN_PROGRESS]: {
			[REFERRAL_STATUS.COMPLETED]: 75,
			[REFERRAL_STATUS.ON_HOLD]: 25,
		},
		[REFERRAL_STATUS.ON_HOLD]: {
			[REFERRAL_STATUS.ACCEPTED]: 40,
			[REFERRAL_STATUS.IN_PROGRESS]: 25,
			[REFERRAL_STATUS.PENDING]: 20,
			[REFERRAL_STATUS.CANCELED]: 15,
		},
	};

	const simulateReferralJourney = (
		createdAt: Date,
	): {
		finalStatus: ReferralStatus;
		steps: { previous: ReferralStatus; next: ReferralStatus; at: Date }[];
	} => {
		const elapsedDays = (NOW.getTime() - createdAt.getTime()) / DAY_MS;
		const maxSteps = Math.min(4, Math.max(0, Math.floor(elapsedDays / 14)));

		const steps: {
			previous: ReferralStatus;
			next: ReferralStatus;
			at: Date;
		}[] = [];
		let current: ReferralStatus = REFERRAL_STATUS.PENDING;
		let cursor = daysAfter(createdAt, faker.number.int({ min: 1, max: 5 }));

		for (let i = 0; i < maxSteps; i++) {
			const options: ReferralStatus[] = STATUS_TRANSITIONS[current];
			if (options.length === 0 || cursor > NOW) break;
			const weights: Partial<Record<ReferralStatus, number>> =
				TRANSITION_WEIGHTS[current] ?? {};
			const next: ReferralStatus = faker.helpers.weightedArrayElement(
				options.map((status) => ({
					value: status,
					weight: weights[status] ?? 1,
				})),
			);
			steps.push({ previous: current, next, at: cursor });
			current = next;
			cursor = daysAfter(cursor, faker.number.int({ min: 3, max: 21 }));
		}

		return { finalStatus: current, steps };
	};

	// `accepted` is included explicitly — it's no longer a
	// `updateReferralStatus` target (assignment auto-accepts instead), but
	// still a doctor-driven event for seed-data attribution purposes.
	const doctorTargets = new Set<ReferralStatus>([
		REFERRAL_STATUS.ACCEPTED,
		...Object.values(DOCTOR_STATUS_TARGETS_BY_STATUS).flat(),
	]);

	const facilitiesWithPatients = eligibleFacilities.filter(
		(f) => (patientsByFacility.get(f.id) ?? []).length > 0,
	);

	const REFERRAL_COUNT = 300;
	const referralRows: ReferralModelInsert[] = [];

	for (let i = 0; i < REFERRAL_COUNT; i++) {
		const origin = faker.helpers.arrayElement(facilitiesWithPatients);
		const destinationCandidates = eligibleFacilities.filter(
			(f) => f.id !== origin.id,
		);
		const destination = faker.helpers.arrayElement(destinationCandidates);

		const originPatients = patientsByFacility.get(origin.id) as PatientLite[];
		const patient = faker.helpers.arrayElement(originPatients);

		const originStaff = activeClinicalByFacility.get(
			origin.id,
		) as CreatedUser[];
		const referrer = faker.helpers.arrayElement(originStaff);

		const destinationDoctors = (
			activeClinicalByFacility.get(destination.id) ?? []
		).filter((u) => u.role === ROLES.DOCTOR);

		const earliestPossible =
			referrer.joinedAt > patient.created_at
				? referrer.joinedAt
				: patient.created_at;
		const createdAt = randomBetween(earliestPossible, NOW);

		const { finalStatus, steps } = simulateReferralJourney(createdAt);
		const involvesDoctor = steps.some((s) => doctorTargets.has(s.next));
		const assignedDoctor =
			involvesDoctor && destinationDoctors.length > 0
				? faker.helpers.arrayElement(destinationDoctors)
				: undefined;

		const specialtyPool =
			facilitySpecialtyMap.get(destination.id) ?? specialtyRows;
		const specialty = faker.helpers.arrayElement(specialtyPool);

		const referralId = generateUuid();
		const updatedAt = steps.length > 0 ? steps[steps.length - 1].at : createdAt;

		referralRows.push({
			id: referralId,
			patient_id: patient.id,
			origin_facility_id: origin.id,
			destination_facility_id: destination.id,
			visit_reason: faker.helpers.arrayElement(VISIT_REASON_NOTES),
			referral_reason: faker.helpers.arrayElement(
				referralReasonTemplates(specialty.name),
			),
			priority: faker.helpers.weightedArrayElement([
				{ weight: 5, value: PRIORITY.MEDIUM },
				{ weight: 2, value: PRIORITY.LOW },
				{ weight: 2, value: PRIORITY.HIGH },
				{ weight: 1, value: PRIORITY.URGENT },
			]),
			status: finalStatus,
			referrer_id: referrer.id,
			doctor: assignedDoctor?.id ?? null,
			created_at: createdAt,
			updated_at: updatedAt,
		});

		for (const step of steps) {
			const changer =
				doctorTargets.has(step.next) && assignedDoctor
					? assignedDoctor.id
					: referrer.id;
			timelineRows.push({
				id: generateUuid(),
				type: TIMELINE_TYPE.REFERRAL,
				entity: referralId,
				action: TIMELINE_ACTION.STATUS_CHANGE,
				previous: step.previous,
				next: step.next,
				changer_id: changer,
				notes: null,
				changed_at: step.at,
			});
		}
	}

	for (const batch of chunk(referralRows, 200)) {
		await connection.insert(ReferralModel).values(batch);
	}
	console.log(`✓ ${referralRows.length} referrals`);

	for (const batch of chunk(timelineRows, 300)) {
		await connection.insert(TimelineModel).values(batch);
	}
	console.log(`✓ ${timelineRows.length} timeline entries`);

	// ---------- Logins ----------
	const loginRows: LoginsModelInsert[] = [];

	for (const u of createdUsers) {
		if (
			u.targetStatus === USER_STATUS.PENDING ||
			u.targetStatus === USER_STATUS.REJECTED
		) {
			continue;
		}

		const leftEarly =
			u.targetStatus === USER_STATUS.DISABLED ||
			u.targetStatus === USER_STATUS.DEPARTED;
		const approvedAt = daysAfter(
			u.joinedAt,
			faker.number.int({ min: 1, max: 4 }),
		);
		const cutoff = leftEarly
			? randomBetween(daysAfter(approvedAt, 30), NOW)
			: NOW;

		const tenureDays = Math.max(
			1,
			(cutoff.getTime() - approvedAt.getTime()) / DAY_MS,
		);
		const loginCount = Math.min(
			150,
			Math.max(
				8,
				Math.round((tenureDays / 7) * faker.number.float({ min: 0.6, max: 2 })),
			),
		);

		for (let i = 0; i < loginCount; i++) {
			const attemptAt = randomBetween(approvedAt, cutoff);
			const isSuccess = faker.number.float({ min: 0, max: 1 }) > 0.1;

			if (isSuccess) {
				const sessionMinutes = faker.number.int({ min: 5, max: 240 });
				loginRows.push({
					id: generateUuid(),
					user_id: u.id,
					login_at: attemptAt,
					logout_at: new Date(attemptAt.getTime() + sessionMinutes * 60 * 1000),
					ip: faker.internet.ip(),
					device: faker.internet.userAgent(),
					status: LOGIN_STATUS.SUCCESS,
					reason: null,
				});
			} else {
				loginRows.push({
					id: generateUuid(),
					user_id: u.id,
					login_at: attemptAt,
					logout_at: null,
					ip: faker.internet.ip(),
					device: faker.internet.userAgent(),
					status: LOGIN_STATUS.FAILED,
					reason: faker.helpers.arrayElement(FAILED_LOGIN_REASONS),
				});
			}
		}
	}

	for (const batch of chunk(loginRows, 300)) {
		await connection.insert(LoginsModel).values(batch);
	}
	console.log(`✓ ${loginRows.length} login events`);

	console.log("✅ Seed complete");
	console.log("   Standard accounts (password: Password@123):");
	console.log(
		"   administrator@gmail.com / manager@gmail.com / nurse@gmail.com / doctor@gmail.com",
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await client.end();
	});
