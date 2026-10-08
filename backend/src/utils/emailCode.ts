import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import type { EmailCodePurpose } from "@prisma/client";
import httpStatus from "http-status";

import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "./AppError";

export const CODE_TTL_MINUTES = 10;
const CODE_TTL_MS = CODE_TTL_MINUTES * 60 * 1000;
const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;

// A keyed hash: a leaked table cannot be turned back into live codes without
// the server secret, and a code for one user/purpose is useless for another.
const hashCode = (userId: string, purpose: EmailCodePurpose, code: string) =>
	createHmac("sha256", config.jwt_access_secret)
		.update(`${userId}:${purpose}:${code}`)
		.digest("hex");

const invalidCode = () =>
	new AppError(
		httpStatus.BAD_REQUEST,
		"That code is invalid or has expired. Request a new one.",
	);

/**
 * Creates a fresh 6-digit code for the user and returns it, replacing any
 * earlier one. Returns null (and sends nothing) if a code was issued less than
 * a minute ago: callers stay silent about it so nobody can probe which
 * addresses have accounts, and the UI enforces the same cooldown on its button.
 */
export const issueCode = async (
	userId: string,
	purpose: EmailCodePurpose,
): Promise<string | null> => {
	const latest = await prisma.emailCode.findFirst({
		where: { userId, purpose },
		orderBy: { createdAt: "desc" },
		select: { createdAt: true },
	});
	if (
		latest &&
		Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000
	) {
		return null;
	}

	const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
	await prisma.$transaction([
		prisma.emailCode.deleteMany({ where: { userId, purpose } }),
		prisma.emailCode.create({
			data: {
				userId,
				purpose,
				codeHash: hashCode(userId, purpose, code),
				expiresAt: new Date(Date.now() + CODE_TTL_MS),
			},
		}),
	]);
	return code;
};

/** Checks and consumes a code. Throws a generic error for every failure mode. */
export const consumeCode = async (
	userId: string,
	purpose: EmailCodePurpose,
	code: string,
): Promise<void> => {
	const record = await prisma.emailCode.findFirst({
		where: { userId, purpose, expiresAt: { gt: new Date() } },
		orderBy: { createdAt: "desc" },
	});
	if (!record) throw invalidCode();

	if (record.attempts >= MAX_ATTEMPTS) {
		await prisma.emailCode.delete({ where: { id: record.id } });
		throw invalidCode();
	}

	const expected = Buffer.from(record.codeHash, "hex");
	const given = Buffer.from(hashCode(userId, purpose, code), "hex");
	if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
		const updated = await prisma.emailCode.update({
			where: { id: record.id },
			data: { attempts: { increment: 1 } },
		});
		const left = MAX_ATTEMPTS - updated.attempts;
		if (left <= 0) {
			await prisma.emailCode.delete({ where: { id: record.id } });
			throw invalidCode();
		}
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`,
		);
	}

	await prisma.emailCode.delete({ where: { id: record.id } });
};
