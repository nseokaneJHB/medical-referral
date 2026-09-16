import type { FastifyReply, FastifyRequest } from "fastify";

import {
	ROLES,
	NDA_VERSION,
	HTTP_RESPONSE_CODE,
	type GlobalResponse,
	type Role,
} from "@referral-tracking/shared";

import { isAccountUsable, isFacilityUsable } from "../lib/permission";

const forbidden = (reply: FastifyReply, message: string): void => {
	const { code, status } = HTTP_RESPONSE_CODE.FORBIDDEN;
	const response: GlobalResponse = { code, message };
	reply.status(status).send(response);
};

/**
 * `app.authorize([roles])` — role check, then the account/facility
 * usability gate. This is where `PENDING`/`REJECTED`/`DISABLED` accounts
 * (and users at a non-`APPROVED` facility) actually get blocked from every
 * role-gated route — `authenticate` deliberately lets them sign in (see
 * its own docstring), so every existing protected route gets this gating
 * "for free" just by already using `app.authorize`, with zero changes to
 * any of their `preHandler` arrays. `FLAGGED` is deliberately NOT blocked
 * here — see `lib/permission.ts`'s `isAccountUsable`/`isFacilityUsable`
 * docstrings for why.
 */
export const authorize = (allowedRoles: Role | Role[]) => {
	const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

	return async (
		request: FastifyRequest,
		reply: FastifyReply,
	): Promise<void> => {
		const user = request.user!;

		if (!roles.includes(user.role as Role)) {
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
			const facility = await request.server.core.facility.one({
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
