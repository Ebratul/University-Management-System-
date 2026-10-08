import nodemailer, { type Transporter } from "nodemailer";

import config from "../config";

export type TMailMessage = {
	to: string;
	subject: string;
	text: string;
	html: string;
};

type TTransport = (message: TMailMessage) => Promise<void>;

// Tests replace the transport to read the code that "was emailed".
let transportOverride: TTransport | null = null;
export const setMailTransportForTests = (transport: TTransport | null) => {
	transportOverride = transport;
};

let smtp: Transporter | null = null;
const getSmtp = () => {
	smtp ??= nodemailer.createTransport({
		host: config.smtp_host,
		port: config.smtp_port,
		secure: config.smtp_secure,
		auth: config.smtp_user
			? { user: config.smtp_user, pass: config.smtp_pass }
			: undefined,
	});
	return smtp;
};

export const sendMail = async (message: TMailMessage): Promise<void> => {
	if (transportOverride) return transportOverride(message);

	if (!config.smtp_host) {
		if (config.node_env === "production") {
			throw new Error("Email is not configured (SMTP_HOST is empty).");
		}
		// Development convenience: no mail server needed to try the flow.
		console.log(
			`\n[mail:dev] To: ${message.to}\n[mail:dev] Subject: ${message.subject}\n${message.text}\n`,
		);
		return;
	}

	await getSmtp().sendMail({ from: config.mail_from, ...message });
};
