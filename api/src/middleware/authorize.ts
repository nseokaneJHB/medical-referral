import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	NDA_VERSION,
	HTTP_RESPONSE_CODE,
	type GlobalResponse,
	type Role,
} from "@referral-tracking/shared";

import { isAccountUsable, isFacilityUsable } from "../lib/permission";

import { facilityOne } from "../repository/facility";

/** Sends a `FORBIDDEN` response with the given message. */
const forbidden = (reply: FastifyReply, message: string): void => {
	const { code, status } = HTTP_RESPONSE_CODE.FORBIDDEN;
	const response: GlobalResponse = { code, message };
	reply.status(status).send(response);
};

/** `app.authorize([roles])` — role check, then the account/facility usability gate that actually blocks PENDING/REJECTED/DISABLED accounts, since `authenticate` deliberately lets them sign in. */
export const authorize = (allowedRoles: Role | Role[]) => {
	const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

	return async (
		request: FastifyRequest,
		reply: FastifyReply,
	): Promise<void> => {
		const user = request.user!;

		if (!roles.includes(user.role)) {
			return forbidden(reply, "Insufficient permissions");
		}

		if (!isAccountUsable(user)) {
			return forbidden(
				reply,
				"Your account isn't active. Check GET /account/status for details.",
			);
		}

		if (user.must_change_password) {
			return forbidden(
				reply,
				"You must change your temporary password before continuing. Use PATCH /account/change-password.",
			);
		}

		if (user.nda_accepted_version !== NDA_VERSION) {
			return forbidden(
				reply,
				"You must accept the NDA before continuing. Use PATCH /account/accept-nda.",
			);
		}

		if (user.role !== ROLES.ADMINISTRATOR && user.facility_id) {
			const facility = await facilityOne(request.server.database, {
				where: { id: user.facility_id },
				select: { status: true },
			});

			if (facility && !isFacilityUsable(facility)) {
				return forbidden(
					reply,
					"Your facility isn't active. Check GET /account/status for details.",
				);
			}
		}
	};
};
