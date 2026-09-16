import { createTransport } from "nodemailer";

import { APP_NAME } from "@referral-tracking/shared";

import { env } from "./env";

export interface EmailContent {
	to: string;
	html: string;
	subject: string;
}

const transport = createTransport({
	host: env.SMTP_HOST,
	port: env.SMTP_PORT,
	secure: env.SMTP_PORT === 465,
	auth: env.SMTP_USER
		? { user: env.SMTP_USER, pass: env.SMTP_PASS }
		: undefined,
});

/**
 * Send one transactional email through the SMTP transport; errors are
 * logged, not thrown, so a flaky send can't fail the request calling it.
 */
export const sendEmail = async (content: EmailContent): Promise<void> => {
	try {
		await transport.sendMail({
			to: content.to,
			html: content.html,
			subject: content.subject,
			from: `"${APP_NAME}" <${env.SMTP_FROM}>`,
		});
	} catch (error) {
		console.error("Failed to send email:", { to: content.to, error });
	}
};
