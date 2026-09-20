import { HTTP_RESPONSE_CODE } from "@referral-tracking/shared";

/** Maps any HTTP status back to this app's HTTP_RESPONSE_CODE, falling back to BAD_REQUEST for anything unmapped. */
export const httpCodeForStatus = (
	status: number,
): (typeof HTTP_RESPONSE_CODE)[keyof typeof HTTP_RESPONSE_CODE]["code"] =>
	Object.values(HTTP_RESPONSE_CODE).find((entry) => entry.status === status)
		?.code ?? HTTP_RESPONSE_CODE.BAD_REQUEST.code;
