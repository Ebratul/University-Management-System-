import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, beforeEach, describe, test } from "node:test";
import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import app from "../../app";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { authLimiter } from "../../middleware/rateLimiter";

// Integration test (real Prisma + Postgres via DATABASE_URL, Google stubbed):
// admin-only university domain configuration and the Google sign-in checks.

const suffix = Date.now().toString();
const PASSWORD = "Password1!";
let server: Server;
let baseUrl: string;

const tokens: Record<string, string> = {};
const userIds: string[] = [];
const departmentIds: string[] = [];
const universityIds: string[] = [];
let semesterId = "";
let deptA = "";
let deptB = "";
let uniA = "";
let uniB = "";
const domains = {
	aStudent: `student.a${suffix}.edu`,
	aTeacher: `teacher.a${suffix}.edu`,
	bStudent: `student.b${suffix}.edu`,
	bTeacher: `teacher.b${suffix}.edu`,
};

// biome-ignore lint/suspicious/noExplicitAny: test helper reads loosely-typed JSON
type TApi = { status: number; body: any };
const api = async (
	method: string,
	path: string,
	token: string | null,
	body?: unknown,
): Promise<TApi> => {
	const res = await fetch(`${baseUrl}${path}`, {
		method,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	return { status: res.status, body: await res.json().catch(() => null) };
};

// What the next verifyIdToken call returns, in place of a real Google check.
let googleIdentity: { email: string; sub: string; email_verified?: boolean } = {
	email: "",
	sub: "",
};
const googleLogin = (identity: typeof googleIdentity) => {
	googleIdentity = identity;
	return api("POST", "/auth/google", null, { idToken: "stub-google-id-token" });
};

const makeUser = async (
	email: string,
	role: Role,
	departmentId: string,
	opts: { isActive?: boolean } = {},
) => {
	const user = await prisma.user.create({
		data: {
			email,
			password: await bcrypt.hash(PASSWORD, Number(config.bcrypt_salt_rounds)),
			role,
			isActive: opts.isActive ?? true,
			...(role === "STUDENT"
				? {
						student: {
							create: {
								studentId: `UNI-${userIds.length}-${suffix}`,
								registrationNumber: `UNI-REG-${userIds.length}-${suffix}`,
								name: "Uni Student",
								departmentId,
								admissionSemesterId: semesterId,
							},
						},
					}
				: role === "FACULTY"
					? {
							faculty: {
								create: {
									facultyId: `UNI-F-${userIds.length}-${suffix}`,
									name: "Uni Teacher",
									departmentId,
								},
							},
						}
					: { admin: { create: { name: "Uni Admin" } } }),
		},
	});
	userIds.push(user.id);
	return user;
};

const login = async (email: string) => {
	const res = await api("POST", "/auth/login", null, {
		email,
		password: PASSWORD,
	});
	assert.equal(res.status, 200, `login ${email}`);
	return res.body.data.accessToken as string;
};

const originalVerify = googleClient.verifyIdToken.bind(googleClient);

before(async () => {
	// biome-ignore lint/suspicious/noExplicitAny: replace the Google network call
	(googleClient as any).verifyIdToken = async () => ({
		getPayload: () => googleIdentity,
	});
	await new Promise<void>((resolve) => {
		server = app.listen(0, resolve);
	});
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("bind failed");
	baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

	const semester = await prisma.semester.create({
		data: {
			year: 2094,
			code: `UNI-SEM-${suffix}`,
			startDate: new Date("2094-01-01"),
			endDate: new Date("2094-05-01"),
			status: "ONGOING",
		},
	});
	semesterId = semester.id;

	const [a, b] = await Promise.all(
		[
			{ name: `Uni A ${suffix}`, s: domains.aStudent, t: domains.aTeacher },
			{ name: `Uni B ${suffix}`, s: domains.bStudent, t: domains.bTeacher },
		].map((u) =>
			prisma.university.create({
				data: { name: u.name, studentDomain: u.s, teacherDomain: u.t },
			}),
		),
	);
	uniA = a.id;
	uniB = b.id;
	universityIds.push(a.id, b.id);

	const [dA, dB] = await Promise.all(
		[
			{ code: `UA${suffix}`.slice(0, 20), universityId: uniA },
			{ code: `UB${suffix}`.slice(0, 20), universityId: uniB },
		].map((d) =>
			prisma.department.create({
				data: { name: `Uni Dept ${d.code}`, ...d },
			}),
		),
	);
	deptA = dA.id;
	deptB = dB.id;
	departmentIds.push(dA.id, dB.id);

	await makeUser(`admin.${suffix}@example.com`, "ADMIN", deptA);
	await makeUser(domainEmail("stu", domains.aStudent), "STUDENT", deptA);
	await makeUser(domainEmail("tch", domains.aTeacher), "FACULTY", deptA);
	tokens.admin = await login(`admin.${suffix}@example.com`);
	tokens.student = await login(domainEmail("stu", domains.aStudent));
	tokens.teacher = await login(domainEmail("tch", domains.aTeacher));
});

function domainEmail(local: string, domain: string) {
	return `${local}${suffix}@${domain}`;
}

beforeEach(async () => {
	for (const key of ["127.0.0.1", "::ffff:127.0.0.1", "::1"])
		await authLimiter.resetKey(key);
});

after(async () => {
	// biome-ignore lint/suspicious/noExplicitAny: restore the real Google call
	(googleClient as any).verifyIdToken = originalVerify;
	await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
	await prisma.student.deleteMany({ where: { userId: { in: userIds } } });
	await prisma.faculty.deleteMany({ where: { userId: { in: userIds } } });
	await prisma.admin.deleteMany({ where: { userId: { in: userIds } } });
	await prisma.user.deleteMany({ where: { id: { in: userIds } } });
	await prisma.department.deleteMany({ where: { id: { in: departmentIds } } });
	await prisma.university.deleteMany({ where: { id: { in: universityIds } } });
	await prisma.semester.deleteMany({ where: { id: semesterId } });
	await new Promise<void>((resolve) => server.close(() => resolve()));
	await prisma.$disconnect();
});

describe("university configuration is admin-only", () => {
	const payload = () => ({
		name: `Auth Uni ${suffix}`,
		studentDomain: `student.auth${suffix}.edu`,
		teacherDomain: `teacher.auth${suffix}.edu`,
	});

	test("anonymous, student and teacher requests are refused", async () => {
		for (const token of [null, tokens.student, tokens.teacher]) {
			const expected = token ? 403 : 401;
			assert.equal((await api("GET", "/universities", token)).status, expected);
			assert.equal(
				(await api("POST", "/universities", token, payload())).status,
				expected,
			);
			assert.equal(
				(
					await api("PATCH", `/universities/${uniA}`, token, {
						isActive: false,
					})
				).status,
				expected,
			);
		}
		const unchanged = await prisma.university.findUnique({
			where: { id: uniA },
		});
		assert.equal(unchanged?.isActive, true);
	});

	test("an admin can create, list and update; domains are normalised", async () => {
		const created = await api("POST", "/universities", tokens.admin, {
			...payload(),
			studentDomain: `@STUDENT.Auth${suffix}.edu`,
		});
		assert.equal(created.status, 201, JSON.stringify(created.body));
		universityIds.push(created.body.data.id);
		assert.equal(created.body.data.studentDomain, `student.auth${suffix}.edu`);

		const list = await api("GET", "/universities", tokens.admin);
		assert.equal(list.status, 200);
		assert.ok(list.body.data.length >= 3);

		const updated = await api(
			"PATCH",
			`/universities/${created.body.data.id}`,
			tokens.admin,
			{ isActive: false },
		);
		assert.equal(updated.status, 200);
		assert.equal(updated.body.data.isActive, false);
	});

	test("conflicting or malformed domains are rejected", async () => {
		const clash = (extra: object) =>
			api("POST", "/universities", tokens.admin, {
				name: `Clash ${Math.random()}`,
				studentDomain: `student.x${suffix}.edu`,
				teacherDomain: `teacher.x${suffix}.edu`,
				...extra,
			});
		// same student domain as another university
		assert.equal(
			(await clash({ studentDomain: domains.aStudent })).status,
			409,
		);
		// a student domain that is another university's teacher domain
		assert.equal(
			(await clash({ studentDomain: domains.bTeacher })).status,
			409,
		);
		// student and teacher the same
		assert.equal(
			(
				await clash({
					studentDomain: `same.x${suffix}.edu`,
					teacherDomain: `same.x${suffix}.edu`,
				})
			).status,
			400,
		);
		// duplicate name
		assert.equal((await clash({ name: `Uni A ${suffix}` })).status, 409);
		for (const bad of ["not a domain", "https://x.edu", "nodot", "a@b.edu"]) {
			assert.equal((await clash({ teacherDomain: bad })).status, 400, bad);
		}
		// an update cannot steal another university's domain either
		const steal = await api("PATCH", `/universities/${uniA}`, tokens.admin, {
			teacherDomain: domains.bStudent,
		});
		assert.equal(steal.status, 409);
	});

	test("only an admin can change a department's university", async () => {
		const asStudent = await api(
			"PATCH",
			`/departments/${deptA}`,
			tokens.student,
			{
				universityId: uniB,
			},
		);
		assert.equal(asStudent.status, 403);
		const dept = await prisma.department.findUnique({ where: { id: deptA } });
		assert.equal(dept?.universityId, uniA);
	});

	test("students and teachers cannot change their own role or department", async () => {
		for (const token of [tokens.student, tokens.teacher]) {
			await api("PATCH", "/users/me", token, {
				role: "ADMIN",
				departmentId: deptB,
			});
		}
		const users = await prisma.user.findMany({
			where: { id: { in: userIds } },
			include: { student: true, faculty: true },
		});
		const student = users.find((u) => u.email.startsWith("stu"));
		const teacher = users.find((u) => u.email.startsWith("tch"));
		assert.equal(student?.role, "STUDENT");
		assert.equal(student?.student?.departmentId, deptA);
		assert.equal(teacher?.role, "FACULTY");
		assert.equal(teacher?.faculty?.departmentId, deptA);
		const promote = await api(
			"PATCH",
			`/users/${student?.id}/role`,
			tokens.student,
			{
				role: "ADMIN",
			},
		);
		assert.equal(promote.status, 403);
	});
});

describe("Google sign-in", () => {
	const ok = (email: string) =>
		googleLogin({ email, sub: `sub-${email}`, email_verified: true });

	test("a registered student and teacher of the university sign in", async () => {
		const s = await ok(domainEmail("stu", domains.aStudent));
		assert.equal(s.status, 200, JSON.stringify(s.body));
		assert.equal(s.body.data.user.role, "STUDENT");
		const t = await ok(domainEmail("tch", domains.aTeacher));
		assert.equal(t.status, 200, JSON.stringify(t.body));
		assert.equal(t.body.data.user.role, "FACULTY");
	});

	test("an unverified Google email is refused", async () => {
		const res = await googleLogin({
			email: domainEmail("stu", domains.aStudent),
			sub: "x",
			email_verified: false,
		});
		assert.equal(res.status, 400);
	});

	test("unknown domains and unregistered users are refused", async () => {
		assert.equal((await ok(`someone${suffix}@gmail.com`)).status, 403);
		assert.equal((await ok(`ghost${suffix}@${domains.aStudent}`)).status, 403);
	});

	test("the domain's role must match the user's role", async () => {
		// a teacher record using the student domain, and the reverse
		await makeUser(
			domainEmail("wrongrole1", domains.aStudent),
			"FACULTY",
			deptA,
		);
		await makeUser(
			domainEmail("wrongrole2", domains.aTeacher),
			"STUDENT",
			deptA,
		);
		assert.equal(
			(await ok(domainEmail("wrongrole1", domains.aStudent))).status,
			403,
		);
		assert.equal(
			(await ok(domainEmail("wrongrole2", domains.aTeacher))).status,
			403,
		);
		// an admin is never admitted through a university domain
		await makeUser(domainEmail("adm", domains.aTeacher), "ADMIN", deptA);
		assert.equal((await ok(domainEmail("adm", domains.aTeacher))).status, 403);
	});

	test("the user must belong to the university that owns the domain", async () => {
		// registered in university B's department but using university A's domain
		await makeUser(domainEmail("cross", domains.aStudent), "STUDENT", deptB);
		assert.equal(
			(await ok(domainEmail("cross", domains.aStudent))).status,
			403,
		);
		// a department with no university never matches
		const loose = await prisma.department.create({
			data: { name: `Loose ${suffix}`, code: `LS${suffix}`.slice(0, 20) },
		});
		departmentIds.push(loose.id);
		await makeUser(domainEmail("loose", domains.aStudent), "STUDENT", loose.id);
		assert.equal(
			(await ok(domainEmail("loose", domains.aStudent))).status,
			403,
		);
	});

	test("an inactive university or inactive user is refused", async () => {
		await makeUser(domainEmail("off", domains.bStudent), "STUDENT", deptB, {
			isActive: false,
		});
		assert.equal((await ok(domainEmail("off", domains.bStudent))).status, 403);

		await makeUser(domainEmail("on", domains.bStudent), "STUDENT", deptB);
		assert.equal((await ok(domainEmail("on", domains.bStudent))).status, 200);
		await api("PATCH", `/universities/${uniB}`, tokens.admin, {
			isActive: false,
		});
		assert.equal((await ok(domainEmail("on", domains.bStudent))).status, 403);
		await api("PATCH", `/universities/${uniB}`, tokens.admin, {
			isActive: true,
		});
		assert.equal((await ok(domainEmail("on", domains.bStudent))).status, 200);
	});

	test("an account linked to one Google identity cannot be taken by another", async () => {
		const email = domainEmail("stu", domains.aStudent);
		assert.equal((await ok(email)).status, 200);
		const other = await googleLogin({
			email,
			sub: "attacker-sub",
			email_verified: true,
		});
		assert.equal(other.status, 403);
	});

	test("password login still works", async () => {
		assert.ok(await login(domainEmail("stu", domains.aStudent)));
	});
});
