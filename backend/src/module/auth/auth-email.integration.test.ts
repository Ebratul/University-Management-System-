import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, beforeEach, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import app from "../../app";
import config from "../../config";
import { type TMailMessage, setMailTransportForTests } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { authLimiter } from "../../middleware/rateLimiter";

// Integration test (real Prisma + Postgres via DATABASE_URL): email
// verification and password reset with emailed 6-digit codes. Emails go to an
// in-memory outbox instead of an SMTP server.

const suffix = Date.now().toString();
const PASSWORD = "Password1!";
let server: Server;
let baseUrl: string;
const outbox: TMailMessage[] = [];
const userIds: string[] = [];
let departmentId = "";
let semesterId = "";

// biome-ignore lint/suspicious/noExplicitAny: test helper reads loosely-typed JSON
type TApi = { status: number; body: any; setCookie: string[] };
const post = async (path: string, body: unknown): Promise<TApi> => {
	const res = await fetch(`${baseUrl}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return {
		status: res.status,
		body: await res.json().catch(() => null),
		setCookie: res.headers.getSetCookie(),
	};
};

const lastCode = (to: string): string => {
	const mail = [...outbox].reverse().find((m) => m.to === to);
	assert.ok(mail, `no email was sent to ${to}`);
	const match = mail.text.match(/\b(\d{6})\b/);
	assert.ok(match, "the email has no 6-digit code");
	return match[1];
};

const makeUser = async (label: string, verified: boolean) => {
	const email = `mail.${label}.${suffix}@example.com`.toLowerCase();
	const user = await prisma.user.create({
		data: {
			email,
			password: await bcrypt.hash(PASSWORD, Number(config.bcrypt_salt_rounds)),
			role: "STUDENT",
			emailVerified: verified,
			student: {
				create: {
					studentId: `ML-${label}-${suffix}`,
					registrationNumber: `ML-REG-${label}-${suffix}`.toUpperCase(),
					name: `Mail ${label}`,
					departmentId,
					admissionSemesterId: semesterId,
				},
			},
		},
	});
	userIds.push(user.id);
	return { id: user.id, email };
};

// Skips the one-minute resend cooldown so a test can ask for a new code.
const clearCodes = (userId: string) =>
	prisma.emailCode.deleteMany({ where: { userId } });

before(async () => {
	setMailTransportForTests(async (m) => {
		outbox.push(m);
	});
	await new Promise<void>((resolve) => {
		server = app.listen(0, resolve);
	});
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("bind failed");
	baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

	const department = await prisma.department.create({
		data: { name: `Mail Dept ${suffix}`, code: `ML${suffix}`.slice(0, 20) },
	});
	departmentId = department.id;
	const semester = await prisma.semester.create({
		data: {
			year: 2095,
			code: `ML-SEM-${suffix}`,
			startDate: new Date("2095-01-01"),
			endDate: new Date("2095-05-01"),
			status: "ONGOING",
		},
	});
	semesterId = semester.id;
});

beforeEach(async () => {
	for (const key of ["127.0.0.1", "::ffff:127.0.0.1", "::1"])
		await authLimiter.resetKey(key);
});

after(async () => {
	setMailTransportForTests(null);
	await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
	await prisma.student.deleteMany({ where: { userId: { in: userIds } } });
	await prisma.user.deleteMany({ where: { id: { in: userIds } } });
	await prisma.semester.deleteMany({ where: { id: semesterId } });
	await prisma.department.deleteMany({ where: { id: departmentId } });
	await new Promise<void>((resolve) => server.close(() => resolve()));
	await prisma.$disconnect();
});

describe("email verification", () => {
	test("an unverified account cannot log in; the reason is only given with the right password", async () => {
		const u = await makeUser("a", false);
		const wrong = await post("/auth/login", {
			email: u.email,
			password: "Wrong1!pass",
		});
		assert.equal(
			wrong.status,
			401,
			"wrong password must not reveal verification status",
		);

		const right = await post("/auth/login", {
			email: u.email,
			password: PASSWORD,
		});
		assert.equal(right.status, 403);
		assert.deepEqual(right.body.errors, [
			{ path: "email", message: "EMAIL_NOT_VERIFIED" },
		]);
		assert.equal(
			right.setCookie.length,
			0,
			"no session cookies for an unverified account",
		);
	});

	test("resend emails a 6-digit code; the answer is the same for unknown addresses", async () => {
		const u = await makeUser("b", false);
		const before = outbox.length;
		const ok = await post("/auth/resend-verification", { email: u.email });
		assert.equal(ok.status, 200);
		assert.equal(outbox.length, before + 1);
		assert.match(lastCode(u.email), /^\d{6}$/);

		const unknown = await post("/auth/resend-verification", {
			email: `nobody.${suffix}@example.com`,
		});
		assert.equal(unknown.status, 200);
		assert.equal(
			unknown.body.message,
			ok.body.message,
			"no hint whether the account exists",
		);
		assert.equal(
			outbox.length,
			before + 1,
			"nothing is sent to unknown addresses",
		);
	});

	test("the code is stored hashed and a second request inside a minute sends nothing", async () => {
		const u = await makeUser("c", false);
		await post("/auth/resend-verification", { email: u.email });
		const code = lastCode(u.email);
		const row = await prisma.emailCode.findFirstOrThrow({
			where: { userId: u.id },
		});
		assert.notEqual(row.codeHash, code);
		assert.ok(!row.codeHash.includes(code));

		const sent = outbox.length;
		const again = await post("/auth/resend-verification", { email: u.email });
		assert.equal(again.status, 200, "same generic answer");
		assert.equal(outbox.length, sent, "cooldown: no second email");
	});

	test("wrong codes are counted and the code dies after 5 mistakes", async () => {
		const u = await makeUser("d", false);
		await post("/auth/resend-verification", { email: u.email });
		const real = lastCode(u.email);
		const wrong = real === "000000" ? "111111" : "000000";

		const first = await post("/auth/verify-email", {
			email: u.email,
			code: wrong,
		});
		assert.equal(first.status, 400);
		assert.match(first.body.message, /4 attempts left/);
		for (let i = 0; i < 4; i++)
			await post("/auth/verify-email", { email: u.email, code: wrong });

		const late = await post("/auth/verify-email", {
			email: u.email,
			code: real,
		});
		assert.equal(
			late.status,
			400,
			"even the right code is refused once attempts ran out",
		);
		assert.equal(
			(await prisma.user.findUniqueOrThrow({ where: { id: u.id } }))
				.emailVerified,
			false,
		);
	});

	test("an expired code is refused", async () => {
		const u = await makeUser("e", false);
		await post("/auth/resend-verification", { email: u.email });
		const code = lastCode(u.email);
		await prisma.emailCode.updateMany({
			where: { userId: u.id },
			data: { expiresAt: new Date(Date.now() - 1000) },
		});
		assert.equal(
			(await post("/auth/verify-email", { email: u.email, code })).status,
			400,
		);
	});

	test("the right code verifies, signs the student in, and can be used only once", async () => {
		const u = await makeUser("f", false);
		await post("/auth/resend-verification", { email: u.email });
		const code = lastCode(u.email);

		const bad = await post("/auth/verify-email", {
			email: u.email,
			code: "12ab56",
		});
		assert.equal(bad.status, 400, "format is validated");

		const ok = await post("/auth/verify-email", { email: u.email, code });
		assert.equal(ok.status, 200);
		assert.equal(ok.body.data.user.email, u.email);
		assert.ok(
			ok.setCookie.some((c) => c.startsWith("accessToken=")),
			"session cookie is set",
		);
		assert.equal(
			(await prisma.user.findUniqueOrThrow({ where: { id: u.id } }))
				.emailVerified,
			true,
		);

		assert.equal(
			(await post("/auth/verify-email", { email: u.email, code })).status,
			400,
			"single use",
		);
		assert.equal(
			(await post("/auth/login", { email: u.email, password: PASSWORD }))
				.status,
			200,
		);
	});

	test("an already verified or unknown account gets the same generic refusal", async () => {
		const u = await makeUser("g", true);
		const a = await post("/auth/verify-email", {
			email: u.email,
			code: "123456",
		});
		const b = await post("/auth/verify-email", {
			email: `ghost.${suffix}@example.com`,
			code: "123456",
		});
		assert.equal(a.status, 400);
		assert.equal(b.status, 400);
		assert.equal(a.body.message, b.body.message);
	});
});

describe("forgot / reset password", () => {
	test("forgot-password emails a code only to real accounts, with an identical answer", async () => {
		const u = await makeUser("h", true);
		const sent = outbox.length;
		const real = await post("/auth/forgot-password", { email: u.email });
		const ghost = await post("/auth/forgot-password", {
			email: `ghost2.${suffix}@example.com`,
		});
		assert.equal(real.status, 200);
		assert.equal(real.body.message, ghost.body.message);
		assert.equal(outbox.length, sent + 1);
		assert.match(outbox[outbox.length - 1].subject, /password reset/i);
	});

	test("reset changes the password, signs out other sessions and invalidates the code", async () => {
		const u = await makeUser("i", true);
		const session = await post("/auth/login", {
			email: u.email,
			password: PASSWORD,
		});
		assert.equal(session.status, 200);
		assert.equal(
			await prisma.refreshToken.count({ where: { userId: u.id } }),
			1,
		);

		await post("/auth/forgot-password", { email: u.email });
		const code = lastCode(u.email);

		assert.equal(
			(
				await post("/auth/reset-password", {
					email: u.email,
					code,
					newPassword: "weak",
				})
			).status,
			400,
		);
		const wrong = code === "000000" ? "111111" : "000000";
		assert.equal(
			(
				await post("/auth/reset-password", {
					email: u.email,
					code: wrong,
					newPassword: "NewPassw0rd!",
				})
			).status,
			400,
		);

		const ok = await post("/auth/reset-password", {
			email: u.email,
			code,
			newPassword: "NewPassw0rd!",
		});
		assert.equal(ok.status, 200);
		assert.equal(
			await prisma.refreshToken.count({ where: { userId: u.id } }),
			0,
			"old sessions are revoked",
		);

		assert.equal(
			(await post("/auth/login", { email: u.email, password: PASSWORD }))
				.status,
			401,
			"old password stops working",
		);
		assert.equal(
			(await post("/auth/login", { email: u.email, password: "NewPassw0rd!" }))
				.status,
			200,
		);
		assert.equal(
			(
				await post("/auth/reset-password", {
					email: u.email,
					code,
					newPassword: "Another1!pass",
				})
			).status,
			400,
			"the code is single use",
		);
	});

	test("a reset on an unverified sign-up also confirms the address", async () => {
		const u = await makeUser("j", false);
		await post("/auth/forgot-password", { email: u.email });
		const code = lastCode(u.email);
		assert.equal(
			(
				await post("/auth/reset-password", {
					email: u.email,
					code,
					newPassword: "NewPassw0rd!",
				})
			).status,
			200,
		);
		assert.equal(
			(await prisma.user.findUniqueOrThrow({ where: { id: u.id } }))
				.emailVerified,
			true,
		);
		assert.equal(
			(await post("/auth/login", { email: u.email, password: "NewPassw0rd!" }))
				.status,
			200,
		);
	});

	test("codes for verification and reset are not interchangeable", async () => {
		const u = await makeUser("k", false);
		await post("/auth/resend-verification", { email: u.email });
		const verifyCode = lastCode(u.email);
		const asReset = await post("/auth/reset-password", {
			email: u.email,
			code: verifyCode,
			newPassword: "NewPassw0rd!",
		});
		assert.equal(
			asReset.status,
			400,
			"a verification code cannot reset a password",
		);
		await clearCodes(u.id);
	});
});
