import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
	TIMELINE_TYPE,
	TIMELINE_ACTION,
	HTTP_RESPONSE_CODE,
} from "@referral-tracking/shared";

import { generateUuid } from "../../lib/util";
import { canFileAppeal } from "../../lib/permission";

import { AppealManager } from "../../management/appeal";

import type { AccountStatusRequest, AppealSubmitRequest } from "./type";

/**
 * Latest timeline row for an entity, whatever action it was — used as
 * "the reason you're currently in this state," regardless of which
 * specific action put you there.
 */
const latestReason = async (
	server: FastifyInstance,
	type: (typeof TIMELINE_TYPE)[keyof typeof TIMELINE_TYPE],
	entity: string,
): Promise<string | null> => {
	const result = await server.core.timeline.many({
		page: 1,
		limit: 1,
		where: { type, entity },
		order: { changed_at: "desc" },
		select: { notes: true },
	});

	return result.data[0]?.notes ?? null;
};

export const accountStatus = async (
	request: FastifyRequest<AccountStatusRequest>,
	reply: FastifyReply<AccountStatusRequest>,
): Promise<void> => {
	const user = request.user!;

	const [reason, facility] = await Promise.all([
		latestReason(request.server, TIMELINE_TYPE.USER, user.id),
		user.facility_id
			? request.server.core.facility.one({
					where: { id: user.facility_id },
					select: { id: true, name: true, status: true },
				})
			: Promise.resolve(null),
	]);

	const facilityReason = facility
		? await latestReason(request.server, TIMELINE_TYPE.FACILITY, facility.id)
		: null;

	const { status, code } = HTTP_RESPONSE_CODE.OK;
	reply.status(status).send({
		code,
		message: "Account status retrieved.",
		data: {
			status: user.status,
			must_change_password: user.must_change_password,
			reason,
			facility: facility
				? {
						id: facility.id,
						name: facility.name,
						status: facility.status,
						reason: facilityReason,
					}
				: null,
		},
	});
};

export const appealSubmit = async (
	request: FastifyRequest<AppealSubmitRequest>,
	reply: FastifyReply<AppealSubmitRequest>,
): Promise<void> => {
	const user = request.user!;

	if (!canFileAppeal(user)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message:
				"There's nothing to appeal right now — check GET /account/status.",
		});
	}

	const appealManager = new AppealManager(request.server.core);
	if (await appealManager.hasOpenAppeal(TIMELINE_TYPE.USER, user.id)) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		return reply.status(status).send({
			code,
			message: "You already have a pending appeal — wait for it to be decided.",
		});
	}

	const [entry] = await request.server.core.timeline.create({
		data: {
			id: generateUuid(),
			type: TIMELINE_TYPE.USER,
			entity: user.id,
			action: TIMELINE_ACTION.APPEAL_SUBMITTED,
			previous: null,
			next: null,
			changer_id: user.id,
			notes: request.body.reason,
		},
		select: {
			id: true,
			type: true,
			entity: true,
			action: true,
			previous: true,
			next: true,
			notes: true,
			changed_at: true,
		},
	});

	const { status, code } = HTTP_RESPONSE_CODE.CREATED;
	reply.status(status).send({
		code,
		message: "Appeal submitted.",
		data: { ...entry, changer: { id: user.id, name: user.name } },
	});
};
