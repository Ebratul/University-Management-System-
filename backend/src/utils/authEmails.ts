import type { EmailCodePurpose } from "@prisma/client";

import { sendMail } from "../lib/mailer";
import { prisma } from "../lib/prisma";
import { CODE_TTL_MINUTES } from "./emailCode";

const escapeHtml = (value: string) =>
	value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const universityName = async (): Promise<string> => {
	try {
		const row = await prisma.websiteSettings.findUnique({
			where: { id: "global" },
			select: { universityName: true },
		});
		return row?.universityName ?? "University Management System";
	} catch {
		return "University Management System";
	}
};

const COPY: Record<
	EmailCodePurpose,
	{ subject: string; headline: string; intro: string }
> = {
	VERIFY_EMAIL: {
		subject: "Your email verification code",
		headline: "Verify your email address",
		intro: "Use this code to finish creating your account.",
	},
	RESET_PASSWORD: {
		subject: "Your password reset code",
		headline: "Reset your password",
		intro: "Use this code to choose a new password.",
	},
};

export const sendCodeEmail = async (
	to: string,
	name: string,
	purpose: EmailCodePurpose,
	code: string,
): Promise<void> => {
	const uni = await universityName();
	const copy = COPY[purpose];
	const greeting = name ? `Hello ${name},` : "Hello,";
	const text = [
		greeting,
		"",
		copy.intro,
		"",
		`    ${code}`,
		"",
		`This code expires in ${CODE_TTL_MINUTES} minutes. If you did not ask for it, you can ignore this email. Nobody can use it without your email inbox.`,
		"",
		`— ${uni}`,
	].join("\n");

	const html = `<!doctype html><html><body style="margin:0;background:#f4f5fb;font-family:Arial,Helvetica,sans-serif;color:#1b1d2a">
<div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e5f1">
<div style="background:linear-gradient(135deg,#4f46e5,#c026d3);padding:20px 28px;color:#fff;font-size:15px;font-weight:600">${escapeHtml(uni)}</div>
<div style="padding:28px">
<h1 style="margin:0 0 8px;font-size:20px">${copy.headline}</h1>
<p style="margin:0 0 20px;color:#555a6e;line-height:1.5">${escapeHtml(greeting)} ${copy.intro}</p>
<div style="font-size:34px;letter-spacing:10px;font-weight:700;text-align:center;background:#f4f5fb;border-radius:10px;padding:16px 0;font-family:'Courier New',monospace">${code}</div>
<p style="margin:20px 0 0;color:#777c90;font-size:13px;line-height:1.5">This code expires in ${CODE_TTL_MINUTES} minutes. If you did not ask for it, you can safely ignore this email.</p>
</div></div></body></html>`;

	await sendMail({ to, subject: `${copy.subject} — ${uni}`, text, html });
};
