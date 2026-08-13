import type { FastifyInstance } from "fastify";

import { API_URLS, API_PATHS } from "@referral-tracking/shared";

import { route as authRoute } from "../modules/authentication/route";
import { route as patientsRoute } from "../modules/patients/route";
import { route as referralsRoute } from "../modules/referrals/route";
import { route as facilitiesRoute } from "../modules/facilities/route";
import { route as specialtiesRoute } from "../modules/specialties/route";
import { route as auditRoute } from "../modules/audit/route";
import { route as usersRoute } from "../modules/users/route";
import { route as dashboardRoute } from "../modules/dashboard/route";
import { route as reportsRoute } from "../modules/reports/route";
import { route as accountRoute } from "../modules/account/route";
import { route as administratorRoute } from "../modules/administrator/route";
import { route as managerRoute } from "../modules/manager/route";

import { env } from "../lib/env";

export const route = async (app: FastifyInstance): Promise<void> => {
	const {
		AUTH,
		PATIENTS,
		REFERRALS,
		FACILITIES,
		SPECIALTIES,
		AUDIT,
		USERS,
		DASHBOARD,
		REPORTS,
		ACCOUNT,
		ADMINISTRATOR,
		MANAGER,
	} = API_URLS(env.API_VERSION);

	await app.register(
		async (k8) => {
			k8.get(API_PATHS.LIVEZ, async (_request, reply) => {
				return reply.status(200).send({ status: "ok" });
			});

			k8.get(API_PATHS.READYZ, async (_request, reply) => {
				return reply.status(200).send({ status: "ok" });
			});
		},
		{ prefix: "/k8" },
	);

	await app.register(authRoute, { prefix: AUTH });
	await app.register(patientsRoute, { prefix: PATIENTS });
	await app.register(referralsRoute, { prefix: REFERRALS });
	await app.register(facilitiesRoute, { prefix: FACILITIES });
	await app.register(specialtiesRoute, { prefix: SPECIALTIES });
	await app.register(auditRoute, { prefix: AUDIT });
	await app.register(usersRoute, { prefix: USERS });
	await app.register(dashboardRoute, { prefix: DASHBOARD });
	await app.register(reportsRoute, { prefix: REPORTS });
	await app.register(accountRoute, { prefix: ACCOUNT });
	await app.register(administratorRoute, { prefix: ADMINISTRATOR });
	await app.register(managerRoute, { prefix: MANAGER });
};
