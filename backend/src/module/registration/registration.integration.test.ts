import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, beforeEach, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import app from "../../app";
import config from "../../config";
import {
	type IBkashExecutePaymentResult,
	setBkashGatewayForTests,
} from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { authLimiter } from "../../middleware/rateLimiter";

// Integration test (real Prisma + Postgres via DATABASE_URL, bKash stubbed):
// the whole course-registration + credit-fee payment workflow and its rules.

const suffix = Date.now().toString();
const PASSWORD = "Password1!";
let server: Server;
let baseUrl: string;

const tokens: Record<string, string> = {};
const profile: Record<string, string> = {};
const ids = {
	userIds: [] as string[],
	departmentIds: [] as string[],
	semesterIds: [] as string[],
	courseIds: [] as string[],
	offeringIds: [] as string[],
	facultyId: "",
};
const o: Record<string, string> = {}; // offering ids by name
const c: Record<string, string> = {}; // course ids by name
let semesterId = "";
let freeSemesterId = "";
let deptId = "";
let otherDeptId = "";

// ---- bKash stub -----------------------------------------------------------
let createCalls: { amount: number; invoiceNumber: string }[] = [];
let nextPaymentSeq = 0;
let gatewayResult: Partial<IBkashExecutePaymentResult> = {};
let createFails = false;
const paymentAmounts = new Map<string, number>();
const paymentInvoices = new Map<string, string>();

const stubResult = (paymentID: string): IBkashExecutePaymentResult => ({
	paymentID,
	trxID: `TRX${paymentID}`,
	transactionStatus: "Completed",
	statusCode: "0000",
	statusMessage: "Successful",
	amount: (paymentAmounts.get(paymentID) ?? 0).toFixed(2),
	currency: "BDT",
	merchantInvoiceNumber: paymentInvoices.get(paymentID),
	...gatewayResult,
});

// biome-ignore lint/suspicious/noExplicitAny: test helper reads loosely-typed JSON
type TApi = { status: number; body: any; headers: Headers };
const api = async (
	method: string,
	path: string,
	token: string | null,
	body?: unknown,
	raw = false,
): Promise<TApi> => {
	const res = await fetch(`${baseUrl}${path}`, {
		method,
		redirect: "manual",
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	return {
		status: res.status,
		body: raw ? await res.arrayBuffer() : await res.json().catch(() => null),
		headers: res.headers,
	};
};

const makeUser = async (
	label: string,
	role: "ADMIN" | "FACULTY" | "STUDENT",
	opts: { level?: number; dept?: string } = {},
) => {
	const email = `reg.${label}.${suffix}@example.com`.toLowerCase();
	const user = await prisma.user.create({
		data: {
			email,
			password: await bcrypt.hash(PASSWORD, Number(config.bcrypt_salt_rounds)),
			role,
			...(role === "FACULTY"
				? {
						faculty: {
							create: {
								facultyId: `RG-F-${label}-${suffix}`,
								name: `Teacher ${label}`,
								departmentId: deptId,
							},
						},
					}
				: {}),
			...(role === "STUDENT"
				? {
						student: {
							create: {
								studentId: `RG-S-${label}-${suffix}`,
								registrationNumber: `RG-REG-${label}-${suffix}`.toUpperCase(),
								name: `Student ${label}`,
								departmentId: opts.dept ?? deptId,
								admissionSemesterId: semesterId,
								currentSemesterLevel: opts.level ?? 3,
							},
						},
					}
				: {}),
		},
		include: { student: true, faculty: true },
	});
	ids.userIds.push(user.id);
	profile[label] = (user.student?.id ?? user.faculty?.id ?? user.id) as string;
	const res = await api("POST", "/auth/login", null, {
		email,
		password: PASSWORD,
	});
	assert.equal(res.status, 200, `login ${label}`);
	tokens[label] = res.body.data.accessToken;
};

const makeCourse = async (
	name: string,
	credits: number,
	courseType: "THEORY" | "PRACTICAL" | "THESIS",
	opts: { dept?: string; prerequisiteId?: string } = {},
) => {
	const course = await prisma.course.create({
		data: {
			courseCode: `RG${name}${suffix}`.slice(0, 20),
			title: `Course ${name}`,
			credits,
			courseType,
			departmentId: opts.dept ?? deptId,
			prerequisiteId: opts.prerequisiteId,
		},
	});
	ids.courseIds.push(course.id);
	c[name] = course.id;
	return course.id;
};

const makeOffering = async (
	name: string,
	courseName: string,
	opts: {
		semester?: string;
		seats?: number;
		level?: number | null;
		enabled?: boolean;
	} = {},
) => {
	const offering = await prisma.courseOffering.create({
		data: {
			courseId: c[courseName],
			facultyId: ids.facultyId,
			semesterId: opts.semester ?? semesterId,
			maxSeats: opts.seats ?? 40,
			semesterLevel: opts.level === undefined ? 3 : opts.level,
			registrationEnabled: opts.enabled ?? true,
		},
	});
	ids.offeringIds.push(offering.id);
	o[name] = offering.id;
};

const hours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const SETTINGS = {
	theoryRate: 12000,
	practicalRate: 16000,
	otherRate: 20000,
	registrationFee: 50000,
	minCredits: 6,
	maxCredits: 12,
	registrationStart: hours(-1),
	registrationEnd: hours(1),
	lateEnabled: false,
	lateStart: null,
	lateEnd: null,
	lateFee: 0,
	invoiceValidityHours: 72,
};
const setSettings = (patch: Record<string, unknown> = {}, sem = semesterId) =>
	api("PUT", `/registration-settings/${sem}`, tokens.admin, {
		...SETTINGS,
		...patch,
	});

const register = (who: string, offerings: string[], sem = semesterId) =>
	api("POST", "/registrations", tokens[who], {
		semesterId: sem,
		offeringIds: offerings.map((n) => o[n]),
	});

const callback = (paymentID: string, status = "success") =>
	api(
		"GET",
		`/payments/callback?paymentID=${paymentID}&status=${status}`,
		null,
	);

// Registers and starts a payment; returns ids.
const registerAndPay = async (who: string, offerings: string[]) => {
	const reg = await register(who, offerings);
	assert.equal(reg.status, 201, JSON.stringify(reg.body));
	const pay = await api(
		"POST",
		`/registrations/${reg.body.data.id}/pay`,
		tokens[who],
	);
	assert.equal(pay.status, 201, JSON.stringify(pay.body));
	return {
		registrationId: reg.body.data.id as string,
		paymentId: pay.body.data.payment.id as string,
		gatewayId: pay.body.data.payment.gatewayPaymentId as string,
	};
};

before(async () => {
	setBkashGatewayForTests({
		create: async (params) => {
			if (createFails) throw new Error("gateway down");
			createCalls.push(params);
			nextPaymentSeq += 1;
			const paymentID = `PAY${suffix}${nextPaymentSeq}`;
			paymentAmounts.set(paymentID, params.amount);
			paymentInvoices.set(paymentID, params.invoiceNumber);
			return {
				paymentID,
				bkashURL: `https://bkash.test/checkout/${paymentID}`,
			};
		},
		execute: async (paymentID) => stubResult(paymentID),
		query: async (paymentID) => stubResult(paymentID),
	});
	config.frontend_url = "http://frontend.test";

	await new Promise<void>((resolve) => {
		server = app.listen(0, resolve);
	});
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("bind failed");
	baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

	const [d1, d2] = await Promise.all([
		prisma.department.create({
			data: { name: `Reg Dept ${suffix}`, code: `RG${suffix}`.slice(0, 20) },
		}),
		prisma.department.create({
			data: { name: `Other Dept ${suffix}`, code: `OT${suffix}`.slice(0, 20) },
		}),
	]);
	deptId = d1.id;
	otherDeptId = d2.id;
	ids.departmentIds.push(d1.id, d2.id);
	const [s1, s2] = await Promise.all([
		prisma.semester.create({
			data: {
				year: 2093,
				code: `RG-SEM-${suffix}`,
				startDate: new Date("2093-01-01"),
				endDate: new Date("2093-06-01"),
				status: "ONGOING",
			},
		}),
		prisma.semester.create({
			data: {
				year: 2092,
				code: `RG-FREE-${suffix}`,
				startDate: new Date("2092-01-01"),
				endDate: new Date("2092-06-01"),
				status: "ONGOING",
			},
		}),
	]);
	semesterId = s1.id;
	freeSemesterId = s2.id;
	ids.semesterIds.push(s1.id, s2.id);

	await makeUser("admin", "ADMIN");
	await makeUser("teacher", "FACULTY");
	ids.facultyId = profile.teacher;
	for (const name of [
		"s1",
		"s2",
		"s3",
		"s4",
		"s5",
		"s6",
		"s7",
		"s8",
		"s9",
		"s10",
		"late1",
		"late2",
	]) {
		await makeUser(name, "STUDENT");
	}
	await makeUser("otherDept", "STUDENT", { dept: otherDeptId });
	await makeUser("wrongLevel", "STUDENT", { level: 5 });

	// courses: C0 is the prerequisite of C2
	await makeCourse("C0", 3, "THEORY");
	await makeCourse("C1", 3, "THEORY");
	await makeCourse("C2", 3, "THEORY", { prerequisiteId: c.C0 });
	await makeCourse("C3", 1.5, "PRACTICAL");
	await makeCourse("C4", 3, "THEORY");
	await makeCourse("C5", 3, "THEORY", { dept: otherDeptId });
	await makeCourse("C6", 3, "THEORY");
	await makeCourse("C7", 3, "THEORY");
	await makeCourse("C8", 4.5, "THEORY");
	await makeCourse("C9", 3, "THEORY");
	for (const name of ["C0", "C1", "C2", "C3", "C8", "C9"])
		await makeOffering(name, name);
	await makeOffering("C4", "C4", { seats: 1 });
	await makeOffering("C5", "C5");
	await makeOffering("C6", "C6", { level: 5 });
	await makeOffering("C7", "C7", { enabled: false });
	await makeOffering("FREE", "C1", { semester: freeSemesterId });

	assert.equal((await setSettings()).status, 200);
	assert.equal(
		(
			await setSettings(
				{
					theoryRate: 0,
					practicalRate: 0,
					otherRate: 0,
					registrationFee: 0,
					minCredits: 0,
				},
				freeSemesterId,
			)
		).status,
		200,
	);
});

beforeEach(async () => {
	for (const key of ["127.0.0.1", "::ffff:127.0.0.1", "::1"])
		await authLimiter.resetKey(key);
	gatewayResult = {};
	createFails = false;
});

after(async () => {
	setBkashGatewayForTests(null);
	const offerings = { in: ids.offeringIds };
	await prisma.payment.deleteMany({
		where: { semesterId: { in: ids.semesterIds } },
	});
	await prisma.courseRegistration.deleteMany({
		where: { semesterId: { in: ids.semesterIds } },
	});
	await prisma.registrationInvoice.deleteMany({
		where: { semesterId: { in: ids.semesterIds } },
	});
	await prisma.result.deleteMany({
		where: { enrollment: { courseOfferingId: offerings } },
	});
	await prisma.enrollment.deleteMany({
		where: { courseOfferingId: offerings },
	});
	await prisma.courseOffering.deleteMany({ where: { id: offerings } });
	await prisma.course.updateMany({
		where: { id: { in: ids.courseIds } },
		data: { prerequisiteId: null },
	});
	await prisma.course.deleteMany({ where: { id: { in: ids.courseIds } } });
	await prisma.registrationSetting.deleteMany({
		where: { semesterId: { in: ids.semesterIds } },
	});
	await prisma.refreshToken.deleteMany({
		where: { userId: { in: ids.userIds } },
	});
	await prisma.student.deleteMany({ where: { userId: { in: ids.userIds } } });
	await prisma.faculty.deleteMany({ where: { userId: { in: ids.userIds } } });
	await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
	await prisma.semester.deleteMany({ where: { id: { in: ids.semesterIds } } });
	await prisma.department.deleteMany({
		where: { id: { in: ids.departmentIds } },
	});
	await new Promise<void>((resolve) => server.close(() => resolve()));
	await prisma.$disconnect();
	// The course endpoints use the cache, which opens Redis: close it so the process can exit.
	if (redisClient.isOpen) await redisClient.quit();
});

// ============================================================================
describe("admin configuration", () => {
	test("only an admin can read or change fees, limits and windows", async () => {
		assert.equal(
			(
				await api(
					"PUT",
					`/registration-settings/${semesterId}`,
					tokens.s1,
					SETTINGS,
				)
			).status,
			403,
		);
		assert.equal(
			(
				await api(
					"PUT",
					`/registration-settings/${semesterId}`,
					tokens.teacher,
					SETTINGS,
				)
			).status,
			403,
		);
		assert.equal(
			(await api("GET", "/registration-settings", tokens.s1)).status,
			403,
		);
		assert.equal(
			(await api("PUT", `/registration-settings/${semesterId}`, null, SETTINGS))
				.status,
			401,
		);
		const read = await api(
			"GET",
			`/registration-settings/${semesterId}`,
			tokens.admin,
		);
		assert.equal(read.body.data.setting.theoryRate, 12000);
		assert.equal(read.body.data.windowState, "OPEN");
	});

	test("invalid settings are rejected", async () => {
		assert.equal(
			(await setSettings({ registrationEnd: hours(-5) })).status,
			400,
			"ends before it starts",
		);
		assert.equal(
			(await setSettings({ minCredits: 20, maxCredits: 10 })).status,
			400,
			"min above max",
		);
		assert.equal(
			(await setSettings({ theoryRate: -1 })).status,
			400,
			"negative rate",
		);
		assert.equal(
			(await setSettings({ theoryRate: 120.5 })).status,
			400,
			"fractional paisa",
		);
		assert.equal(
			(
				await setSettings({
					lateEnabled: true,
					lateStart: hours(5),
					lateEnd: null,
				})
			).status,
			400,
		);
		assert.equal(
			(
				await setSettings({
					lateEnabled: true,
					lateStart: hours(0.5),
					lateEnd: hours(5),
				})
			).status,
			400,
			"late must follow regular",
		);
	});

	test("a course can be given a half credit, a type, and a prerequisite without loops", async () => {
		const created = await api("POST", "/courses", tokens.admin, {
			courseCode: `ZZ${suffix}`.slice(0, 20),
			title: "Lab",
			credits: 1.5,
			courseType: "PRACTICAL",
			departmentId: deptId,
			prerequisiteId: c.C1,
		});
		assert.equal(created.status, 201);
		ids.courseIds.push(created.body.data.id);
		assert.equal(created.body.data.credits, 1.5);
		assert.equal(created.body.data.prerequisite.id, c.C1);
		assert.equal(
			(await api("PATCH", `/courses/${c.C0}`, tokens.admin, { credits: 1.25 }))
				.status,
			400,
			"multiples of 0.5 only",
		);
		assert.equal(
			(
				await api("PATCH", `/courses/${c.C1}`, tokens.admin, {
					prerequisiteId: c.C1,
				})
			).status,
			400,
			"not its own prerequisite",
		);
		// C2 requires C0; making C0 require C2 would be a loop
		assert.equal(
			(
				await api("PATCH", `/courses/${c.C0}`, tokens.admin, {
					prerequisiteId: c.C2,
				})
			).status,
			400,
		);
	});
});

describe("eligible courses", () => {
	test("a student sees only their department and semester level, with the right state", async () => {
		const res = await api("GET", "/registrations/available", tokens.s1);
		assert.equal(res.status, 200);
		const byCode = new Map<
			string,
			{ state: string; seats: { remaining: number } }
		>(
			res.body.data.courses.map((x: { courseCode: string }) => [
				x.courseCode,
				x,
			]),
		);
		const code = (n: string) => `RG${n}${suffix}`.slice(0, 20);
		assert.equal(byCode.get(code("C1"))?.state, "AVAILABLE");
		assert.equal(byCode.get(code("C3"))?.state, "AVAILABLE");
		assert.equal(byCode.get(code("C2"))?.state, "PREREQUISITE_MISSING");
		assert.equal(byCode.get(code("C4"))?.seats.remaining, 1);
		assert.equal(
			byCode.has(code("C5")),
			false,
			"another department's course is not shown",
		);
		assert.equal(
			byCode.has(code("C6")),
			false,
			"another semester level is not shown",
		);
		assert.equal(
			byCode.has(code("C7")),
			false,
			"registration-disabled offering is not shown",
		);
		assert.equal(res.body.data.window.state, "OPEN");
		assert.equal(res.body.data.semester.id, semesterId);
	});

	test("students of another department or level see a different list; staff cannot use it", async () => {
		const other = await api(
			"GET",
			"/registrations/available",
			tokens.otherDept,
		);
		assert.deepEqual(
			other.body.data.courses.map((x: { courseCode: string }) => x.courseCode),
			[`RGC5${suffix}`.slice(0, 20)],
		);
		const level5 = await api(
			"GET",
			"/registrations/available",
			tokens.wrongLevel,
		);
		assert.deepEqual(
			level5.body.data.courses.map((x: { courseCode: string }) => x.courseCode),
			[`RGC6${suffix}`.slice(0, 20)],
		);
		assert.equal(
			(await api("GET", "/registrations/available", tokens.teacher)).status,
			403,
		);
		assert.equal(
			(await api("GET", "/registrations/available", null)).status,
			401,
		);
	});
});

describe("preview, validation and fee calculation", () => {
	const preview = (who: string, names: string[], sem = semesterId) =>
		api("POST", "/registrations/preview", tokens[who], {
			semesterId: sem,
			offeringIds: names.map((n) => o[n]),
		});

	test("theory + practical: credits, fees and the registration fee all come from the server", async () => {
		const res = await preview("s1", ["C1", "C3", "C8"]);
		assert.equal(res.status, 200);
		assert.equal(
			res.body.data.valid,
			true,
			JSON.stringify(res.body.data.issues),
		);
		const f = res.body.data.summary.fees;
		assert.equal(f.theoryCredits, 7.5);
		assert.equal(f.practicalCredits, 1.5);
		assert.equal(f.totalCredits, 9);
		assert.equal(f.theoryFee, 90000, "7.5 x 120 BDT");
		assert.equal(f.practicalFee, 24000, "1.5 x 160 BDT");
		assert.equal(f.registrationFee, 50000);
		assert.equal(f.lateFee, 0);
		assert.equal(f.totalAmount, 164000);
	});

	test("every rule produces a clear issue, not a crash", async () => {
		const issues = async (who: string, names: string[]) =>
			(await preview(who, names)).body.data.issues.map(
				(i: { code: string }) => i.code,
			);
		assert.ok(
			(await issues("s1", ["C2", "C1", "C3"])).includes("PREREQUISITE_MISSING"),
		);
		assert.ok(
			(await issues("s1", ["C1"])).includes("CREDIT_MINIMUM"),
			"3 credits is below the minimum of 6",
		);
		assert.ok(
			(await issues("s1", ["C1", "C0", "C8", "C9", "C3"])).includes(
				"CREDIT_LIMIT_EXCEEDED",
			),
			"13.5 > 12",
		);
		assert.ok((await issues("s1", [])).includes("NO_COURSES"));
		assert.ok(
			(await issues("otherDept", ["C1", "C0"])).includes(
				"NOT_ELIGIBLE_DEPARTMENT",
			),
		);
		assert.ok(
			(await issues("wrongLevel", ["C1", "C0"])).includes(
				"NOT_ELIGIBLE_SEMESTER",
			),
		);
		assert.ok(
			(await issues("s1", ["C7", "C1", "C0"])).includes(
				"REGISTRATION_DISABLED",
			),
		);
		assert.ok(
			(await issues("s1", ["C5", "C1", "C0"])).includes(
				"NOT_ELIGIBLE_DEPARTMENT",
			),
		);
	});

	test("an offering from another semester is refused", async () => {
		const res = await preview("s1", ["FREE", "C1", "C0"]);
		assert.ok(
			res.body.data.issues.some(
				(i: { code: string }) => i.code === "INVALID_OFFERING",
			),
		);
	});

	test("the registration must be open: not yet, closed, and the late window", async () => {
		const bad = async (patch: Record<string, unknown>) => {
			await setSettings(patch);
			const res = await preview("s1", ["C1", "C0"]);
			await setSettings();
			return res.body.data;
		};
		const notOpen = await bad({
			registrationStart: hours(2),
			registrationEnd: hours(5),
		});
		assert.equal(notOpen.issues[0].code, "REGISTRATION_NOT_OPEN");
		assert.match(notOpen.issues[0].message, /not opened yet/);

		const closed = await bad({
			registrationStart: hours(-9),
			registrationEnd: hours(-5),
		});
		assert.equal(closed.issues[0].code, "REGISTRATION_CLOSED");
		assert.match(closed.issues[0].message, /deadline has passed/);

		const late = await bad({
			registrationStart: hours(-9),
			registrationEnd: hours(-5),
			lateEnabled: true,
			lateStart: hours(-4),
			lateEnd: hours(4),
			lateFee: 20000,
		});
		assert.equal(late.valid, true, JSON.stringify(late.issues));
		assert.equal(late.summary.isLate, true);
		assert.equal(late.summary.fees.lateFee, 20000);
		assert.equal(
			late.summary.fees.totalAmount,
			72000 + 50000 + 20000,
			"6 theory credits + registration + late fee",
		);
	});
});

describe("submitting a registration", () => {
	test("the server prices it: amounts sent by the client are ignored", async () => {
		const res = await api("POST", "/registrations", tokens.s1, {
			semesterId,
			offeringIds: [o.C1, o.C0, o.C3],
			totalAmount: 1,
			theoryFee: 1,
			status: "CONFIRMED",
			credits: 99,
		});
		assert.equal(res.status, 201, JSON.stringify(res.body));
		const reg = res.body.data;
		assert.equal(reg.status, "SUBMITTED");
		assert.equal(reg.invoice.status, "UNPAID");
		assert.equal(
			reg.invoice.totalAmount,
			72000 + 24000 + 50000,
			"6 theory + 1.5 practical + registration fee",
		);
		assert.equal(reg.totalCredits, 7.5);
		assert.equal(reg.items.length, 3);
		assert.match(reg.registrationNo, /^REG-2093-\d{6}$/);
		assert.match(reg.invoice.invoiceNo, /^INV-2093-\d{6}$/);
		assert.equal(reg.canPay, true);
		o.s1reg = reg.id;
	});

	test("seats are reserved but there is no course access before payment", async () => {
		const seats = await prisma.enrollment.findMany({
			where: {
				studentId: profile.s1,
				courseOfferingId: { in: [o.C1, o.C0, o.C3] },
			},
		});
		assert.equal(seats.length, 3);
		assert.ok(seats.every((e) => e.status === "PENDING"));
		assert.equal(
			(await api("GET", `/course-offerings/${o.C1}/materials`, tokens.s1))
				.status,
			403,
			"unpaid: no course homepage access",
		);
	});

	test("only one live registration per student per semester; no duplicate courses", async () => {
		const again = await register("s1", ["C1", "C0", "C8"]);
		assert.equal(again.status, 409);
		assert.match(again.body.message, /already have registration/);
		const dup = await api("POST", "/registrations", tokens.s2, {
			semesterId,
			offeringIds: [o.C1, o.C1],
		});
		assert.equal(dup.status, 400, "a course twice in one request");
	});

	test("a rejected submission leaves nothing behind", async () => {
		const before = await prisma.enrollment.count({
			where: { studentId: profile.s2 },
		});
		const res = await register("s2", ["C2", "C1", "C3"]); // C2 prerequisite missing
		assert.equal(res.status, 400);
		assert.ok(
			res.body.errors.some((e: { message: string }) =>
				/requires/.test(e.message),
			),
		);
		assert.equal(
			await prisma.courseRegistration.count({
				where: { studentId: profile.s2 },
			}),
			0,
		);
		assert.equal(
			await prisma.enrollment.count({ where: { studentId: profile.s2 } }),
			before,
		);
	});

	test("one student can never see or change another student's registration", async () => {
		const id = o.s1reg;
		assert.equal(
			(await api("GET", `/registrations/${id}`, tokens.s2)).status,
			404,
		);
		assert.equal(
			(await api("POST", `/registrations/${id}/pay`, tokens.s2)).status,
			404,
		);
		assert.equal(
			(await api("POST", `/registrations/${id}/cancel`, tokens.s2, {})).status,
			404,
		);
		assert.equal(
			(await api("GET", `/registrations/${id}/receipt`, tokens.s2)).status,
			404,
		);
		assert.equal(
			(await api("GET", `/registrations/${id}`, tokens.teacher)).status,
			403,
		);
		assert.equal(
			(await api("GET", `/registrations/${id}`, tokens.s1)).status,
			200,
		);
		const mine = await api("GET", "/registrations", tokens.s2);
		assert.equal(
			mine.body.data.length,
			0,
			"a student's list only ever holds their own",
		);
	});

	test("changing the fee rates later does not touch an existing invoice", async () => {
		assert.equal(
			(await setSettings({ theoryRate: 99900, registrationFee: 77700 })).status,
			200,
		);
		const res = await api("GET", `/registrations/${o.s1reg}`, tokens.s1);
		assert.equal(res.body.data.invoice.theoryRate, 12000);
		assert.equal(res.body.data.invoice.totalAmount, 72000 + 24000 + 50000);
		assert.equal((await setSettings()).status, 200);
	});
});

describe("payment", () => {
	test("pay starts one bKash payment from the stored invoice amount; Pay again reuses it", async () => {
		createCalls = [];
		const pay = await api("POST", `/registrations/${o.s1reg}/pay`, tokens.s1, {
			amount: 1,
		});
		assert.equal(pay.status, 201);
		assert.equal(createCalls.length, 1);
		assert.equal(
			createCalls[0].amount,
			1460,
			"(72000 + 24000 + 50000) paisa = 1460.00 BDT, ignoring the client",
		);
		assert.match(createCalls[0].invoiceNumber, /^INV-2093-\d{6}-1$/);
		assert.match(pay.body.data.bkashURL, /^https:\/\/bkash\.test\/checkout\//);
		o.s1gateway = pay.body.data.payment.gatewayPaymentId;

		const again = await api("POST", `/registrations/${o.s1reg}/pay`, tokens.s1);
		assert.equal(again.status, 201);
		assert.equal(again.body.data.reused, true);
		assert.equal(again.body.data.bkashURL, pay.body.data.bkashURL);
		assert.equal(createCalls.length, 1, "no second bKash payment was created");

		const reg = await api("GET", `/registrations/${o.s1reg}`, tokens.s1);
		assert.equal(reg.body.data.status, "PAYMENT_PENDING");
		assert.equal(reg.body.data.invoice.status, "PENDING");
		assert.equal(
			reg.body.data.canCancel,
			false,
			"cannot cancel while a payment is open",
		);
		assert.equal(
			(await api("POST", `/registrations/${o.s1reg}/cancel`, tokens.s1, {}))
				.status,
			409,
		);
	});

	test("an unsuccessful return from the gateway never confirms anything", async () => {
		const reg = await prisma.courseRegistration.findUniqueOrThrow({
			where: { id: o.s1reg },
		});
		assert.equal(reg.status, "PAYMENT_PENDING");
		// a payer who simply arrives on the frontend success page proves nothing:
		const res = await api("GET", `/registrations/${o.s1reg}`, tokens.s1);
		assert.notEqual(res.body.data.status, "CONFIRMED");
	});

	test("an unknown payment reference is rejected", async () => {
		assert.equal((await callback("DOES-NOT-EXIST")).status, 404);
	});

	test("verified success: invoice PAID, registration CONFIRMED, enrolled, course access, one payment", async () => {
		const res = await callback(o.s1gateway);
		assert.equal(
			res.status,
			302,
			"the payer's browser is sent back to the frontend",
		);
		const location = res.headers.get("location") ?? "";
		// Every bKash payment lands on the Payments result page.
		const paymentId = (
			await prisma.payment.findUniqueOrThrow({
				where: { gatewayPaymentId: o.s1gateway },
			})
		).id;
		assert.equal(
			location,
			`http://frontend.test/student/payments/result?paymentId=${paymentId}`,
		);

		const reg = (await api("GET", `/registrations/${o.s1reg}`, tokens.s1)).body
			.data;
		assert.equal(reg.status, "CONFIRMED");
		assert.equal(reg.invoice.status, "PAID");
		assert.equal(reg.invoice.payments.length, 1);
		assert.equal(reg.invoice.payments[0].status, "PAID");
		assert.match(reg.invoice.payments[0].transactionId, /^TRX/);
		const seats = await prisma.enrollment.findMany({
			where: {
				studentId: profile.s1,
				courseOfferingId: { in: [o.C1, o.C0, o.C3] },
			},
		});
		assert.ok(seats.every((e) => e.status === "ENROLLED"));
		assert.equal(
			(await api("GET", `/course-offerings/${o.C1}/materials`, tokens.s1))
				.status,
			200,
			"paid: the course homepage opens",
		);
	});

	test("a repeated callback is idempotent", async () => {
		const before = await prisma.payment.count({
			where: {
				registrationInvoiceId: { not: null },
				student: { id: profile.s1 },
			},
		});
		const again = await callback(o.s1gateway);
		assert.equal(again.status, 302);
		await callback(o.s1gateway);
		assert.equal(
			await prisma.payment.count({
				where: {
					registrationInvoiceId: { not: null },
					student: { id: profile.s1 },
				},
			}),
			before,
		);
		const seats = await prisma.enrollment.count({
			where: {
				studentId: profile.s1,
				courseOfferingId: { in: [o.C1, o.C0, o.C3] },
				status: "ENROLLED",
			},
		});
		assert.equal(seats, 3);
		const reg = await prisma.courseRegistration.findUniqueOrThrow({
			where: { id: o.s1reg },
		});
		assert.equal(reg.status, "CONFIRMED");
		assert.equal(
			(await api("POST", `/registrations/${o.s1reg}/pay`, tokens.s1)).status,
			409,
			"an already paid invoice cannot be paid again",
		);
	});

	test("receipt: JSON and a real PDF, only for the owner", async () => {
		const json = await api(
			"GET",
			`/registrations/${o.s1reg}/receipt`,
			tokens.s1,
		);
		assert.equal(json.status, 200);
		assert.equal(json.body.data.invoice.totalAmount, 146000);
		assert.equal(json.body.data.courses.length, 3);
		assert.match(json.body.data.payment.transactionId, /^TRX/);
		const pdf = await api(
			"GET",
			`/registrations/${o.s1reg}/receipt.pdf`,
			tokens.s1,
			undefined,
			true,
		);
		assert.equal(pdf.status, 200);
		assert.match(pdf.headers.get("content-type") ?? "", /application\/pdf/);
		assert.equal(
			Buffer.from(pdf.body as ArrayBuffer)
				.subarray(0, 5)
				.toString(),
			"%PDF-",
		);
		assert.equal(
			(await api("GET", `/registrations/${o.s1reg}/receipt.pdf`, tokens.s2))
				.status,
			404,
		);
	});

	test("a confirmed registration cannot be cancelled", async () => {
		assert.equal(
			(await api("POST", `/registrations/${o.s1reg}/cancel`, tokens.s1, {}))
				.status,
			409,
		);
	});

	test("a wrong amount from the gateway fails the payment, and the student can retry", async () => {
		const first = await registerAndPay("s2", ["C1", "C0"]);
		gatewayResult = { amount: "1.00" };
		await callback(first.gatewayId);
		let reg = (
			await api("GET", `/registrations/${first.registrationId}`, tokens.s2)
		).body.data;
		assert.equal(reg.invoice.status, "FAILED");
		assert.equal(reg.status, "PAYMENT_PENDING", "stays payable");
		assert.equal(reg.invoice.payments[0].status, "FAILED");
		assert.match(reg.invoice.payments[0].failureReason, /Amount mismatch/);
		assert.equal(
			await prisma.enrollment.count({
				where: { studentId: profile.s2, status: "ENROLLED" },
			}),
			0,
		);
		const audit = await prisma.auditLog.count({
			where: {
				action: "PAYMENT_VERIFICATION_MISMATCH",
				entityId: first.paymentId,
			},
		});
		assert.equal(audit, 1);

		// retry: a NEW payment on the SAME registration, not a new registration
		gatewayResult = {};
		createCalls = [];
		const retry = await api(
			"POST",
			`/registrations/${first.registrationId}/pay`,
			tokens.s2,
		);
		assert.equal(retry.status, 201);
		assert.equal(createCalls.length, 1);
		assert.match(createCalls[0].invoiceNumber, /-2$/, "second attempt");
		await callback(retry.body.data.payment.gatewayPaymentId);
		reg = (
			await api("GET", `/registrations/${first.registrationId}`, tokens.s2)
		).body.data;
		assert.equal(reg.status, "CONFIRMED");
		assert.equal(
			await prisma.courseRegistration.count({
				where: { studentId: profile.s2 },
			}),
			1,
			"no second registration was created",
		);
		assert.equal(reg.invoice.payments.length, 2);
	});

	test("a gateway that reports failure or cancellation leaves the invoice payable", async () => {
		const first = await registerAndPay("s3", ["C1", "C0"]);
		await callback(first.gatewayId, "failure");
		let reg = (
			await api("GET", `/registrations/${first.registrationId}`, tokens.s3)
		).body.data;
		assert.equal(reg.invoice.status, "FAILED");
		assert.equal(reg.canPay, true);
		const retry = await api(
			"POST",
			`/registrations/${first.registrationId}/pay`,
			tokens.s3,
		);
		assert.equal(retry.status, 201);
		await callback(retry.body.data.payment.gatewayPaymentId, "cancel");
		reg = (
			await api("GET", `/registrations/${first.registrationId}`, tokens.s3)
		).body.data;
		assert.equal(reg.invoice.status, "FAILED");
		assert.equal(reg.status, "PAYMENT_PENDING");
	});

	test("if bKash cannot be reached the invoice goes back to payable", async () => {
		const reg = await register("s4", ["C1", "C0"]);
		createFails = true;
		const pay = await api(
			"POST",
			`/registrations/${reg.body.data.id}/pay`,
			tokens.s4,
		);
		assert.ok(pay.status >= 500, `gateway failure surfaces as ${pay.status}`);
		createFails = false;
		const after = (
			await api("GET", `/registrations/${reg.body.data.id}`, tokens.s4)
		).body.data;
		assert.equal(after.invoice.status, "UNPAID");
		assert.equal(
			(await api("POST", `/registrations/${reg.body.data.id}/pay`, tokens.s4))
				.status,
			201,
		);
	});

	test("refresh settles a payment whose callback never arrived", async () => {
		const reg = (await api("GET", "/registrations", tokens.s4)).body.data[0];
		const pending = await prisma.payment.findFirstOrThrow({
			where: { registrationInvoiceId: reg.invoice.id, status: "PENDING" },
		});
		assert.ok(pending);
		const res = await api(
			"POST",
			`/registrations/${reg.id}/refresh-payment`,
			tokens.s4,
		);
		assert.equal(res.status, 200);
		assert.equal(res.body.data.status, "CONFIRMED");
	});
});

describe("seats, expiry and cancellation", () => {
	test("two students racing for the last seat: exactly one wins", async () => {
		const sel = (who: string) =>
			api("POST", "/registrations", tokens[who], {
				semesterId,
				offeringIds: [o.C4, o.C0, o.C1],
			});
		const [a, b] = await Promise.all([sel("s5"), sel("s6")]);
		const statuses = [a.status, b.status].sort();
		assert.deepEqual(statuses, [201, 409], `got ${statuses.join(", ")}`);
		assert.equal(
			await prisma.enrollment.count({
				where: {
					courseOfferingId: o.C4,
					status: { in: ["PENDING", "ENROLLED"] },
				},
			}),
			1,
			"never more than the 1 seat",
		);
		const loser = a.status === 409 ? a : b;
		assert.match(loser.body.message, /full/);
		o.winner = a.status === 201 ? "s5" : "s6";
		o.loser = a.status === 201 ? "s6" : "s5";
		o.winnerReg = (a.status === 201 ? a : b).body.data.id;
	});

	test("a full course is shown as FULL and cancelling releases the seat", async () => {
		const full = await api("GET", "/registrations/available", tokens[o.loser]);
		const c4 = full.body.data.courses.find(
			(x: { courseCode: string }) =>
				x.courseCode === `RGC4${suffix}`.slice(0, 20),
		);
		assert.equal(c4.state, "COURSE_FULL");
		assert.equal(c4.seats.remaining, 0);

		const cancel = await api(
			"POST",
			`/registrations/${o.winnerReg}/cancel`,
			tokens[o.winner],
			{ reason: "changed my mind" },
		);
		assert.equal(cancel.status, 200);
		assert.equal(cancel.body.data.status, "CANCELLED");
		assert.equal(cancel.body.data.invoice.status, "CANCELLED");
		assert.equal(
			await prisma.enrollment.count({
				where: {
					courseOfferingId: o.C4,
					status: { in: ["PENDING", "ENROLLED"] },
				},
			}),
			0,
			"seat released",
		);

		const retry = await api("POST", "/registrations", tokens[o.loser], {
			semesterId,
			offeringIds: [o.C4, o.C0, o.C1],
		});
		assert.equal(retry.status, 201, "the seat is available again");
		// and the student who cancelled can register again for the semester
		const again = await register(o.winner, ["C0", "C1"]);
		assert.equal(again.status, 201);
	});

	test("an unpaid invoice expires, frees the seats, and can no longer be paid", async () => {
		const reg = await register("s7", ["C1", "C0"]);
		const id = reg.body.data.id;
		await prisma.registrationInvoice.update({
			where: { registrationId: id },
			data: { expiresAt: new Date(Date.now() - 1000) },
		});

		const pay = await api("POST", `/registrations/${id}/pay`, tokens.s7);
		assert.equal(pay.status, 410);
		const after = (await api("GET", `/registrations/${id}`, tokens.s7)).body
			.data;
		assert.equal(after.status, "EXPIRED");
		assert.equal(after.invoice.status, "EXPIRED");
		assert.equal(
			await prisma.enrollment.count({
				where: {
					studentId: profile.s7,
					status: { in: ["PENDING", "ENROLLED"] },
				},
			}),
			0,
		);
		assert.equal(
			(await register("s7", ["C1", "C0"])).status,
			201,
			"a fresh registration is allowed",
		);
	});

	test("an invoice with a payment in progress does not expire underneath it", async () => {
		const first = await registerAndPay("s8", ["C1", "C0"]);
		await prisma.registrationInvoice.updateMany({
			where: { registrationId: first.registrationId },
			data: { expiresAt: new Date(Date.now() - 1000) },
		});
		const reg = (
			await api("GET", `/registrations/${first.registrationId}`, tokens.s8)
		).body.data;
		assert.equal(reg.status, "PAYMENT_PENDING");
		await callback(first.gatewayId);
		assert.equal(
			(await api("GET", `/registrations/${first.registrationId}`, tokens.s8))
				.body.data.status,
			"CONFIRMED",
		);
	});
});

describe("academic history", () => {
	// The course C1 was taken earlier, in another semester's offering (FREE).
	const takeEarlier = async (who: string, gradePoint: number) => {
		const e = await prisma.enrollment.create({
			data: {
				studentId: profile[who],
				courseOfferingId: o.FREE,
				status: "COMPLETED",
			},
		});
		await prisma.result.create({
			data: {
				enrollmentId: e.id,
				grade: gradePoint > 0 ? "B" : "F",
				gradePoint,
			},
		});
	};
	const states = async (who: string) => {
		const res = await api("GET", "/registrations/available", tokens[who]);
		return new Map<string, string>(
			res.body.data.courses.map((x: { courseCode: string; state: string }) => [
				x.courseCode,
				x.state,
			]),
		);
	};
	const c1 = `RGC1${suffix}`.slice(0, 20);

	test("a passed course cannot be registered again; a failed one can be retaken", async () => {
		await takeEarlier("s9", 3); // passed C1
		await takeEarlier("s10", 0); // failed C1
		assert.equal((await states("s9")).get(c1), "ALREADY_COMPLETED");
		assert.equal((await states("s10")).get(c1), "AVAILABLE");

		const blocked = await register("s9", ["C1", "C8"]);
		assert.equal(blocked.status, 400);
		assert.ok(
			blocked.body.errors.some((e: { message: string }) =>
				/already completed/.test(e.message),
			),
		);
	});

	test("finishing the prerequisite unlocks the course that needs it", async () => {
		const e = await prisma.enrollment.create({
			data: {
				studentId: profile.s9,
				courseOfferingId: o.C0,
				status: "COMPLETED",
			},
		});
		await prisma.result.create({
			data: { enrollmentId: e.id, grade: "A", gradePoint: 4 },
		});
		const c2 = `RGC2${suffix}`.slice(0, 20);
		assert.equal((await states("s9")).get(c2), "AVAILABLE");
	});
});

describe("late registration and zero-fee semesters", () => {
	test("registering in the late window adds the late fee to the invoice snapshot", async () => {
		await setSettings({
			registrationStart: hours(-9),
			registrationEnd: hours(-5),
			lateEnabled: true,
			lateStart: hours(-4),
			lateEnd: hours(4),
			lateFee: 20000,
		});
		const reg = await register("late1", ["C1", "C0"]);
		assert.equal(reg.status, 201, JSON.stringify(reg.body));
		assert.equal(reg.body.data.isLate, true);
		assert.equal(reg.body.data.invoice.lateFee, 20000);
		assert.equal(reg.body.data.invoice.totalAmount, 72000 + 50000 + 20000);
		// after the late window closes too, nobody can register
		await setSettings({
			registrationStart: hours(-9),
			registrationEnd: hours(-8),
			lateEnabled: true,
			lateStart: hours(-7),
			lateEnd: hours(-6),
			lateFee: 20000,
		});
		const closed = await register("late2", ["C1", "C0"]);
		assert.equal(closed.status, 400);
		assert.match(closed.body.message, /deadline has passed/);
		await setSettings();
	});

	test("a semester with no fees confirms immediately, with no payment", async () => {
		const reg = await register("s1", ["FREE"], freeSemesterId);
		assert.equal(reg.status, 201, JSON.stringify(reg.body));
		assert.equal(reg.body.data.status, "CONFIRMED");
		assert.equal(reg.body.data.invoice.status, "PAID");
		assert.equal(reg.body.data.invoice.totalAmount, 0);
		assert.equal(reg.body.data.paymentRequired, false);
		const e = await prisma.enrollment.findFirstOrThrow({
			where: { studentId: profile.s1, courseOfferingId: o.FREE },
		});
		assert.equal(e.status, "ENROLLED");
		assert.equal(
			(await api("POST", `/registrations/${reg.body.data.id}/pay`, tokens.s1))
				.status,
			409,
		);
		const receipt = await api(
			"GET",
			`/registrations/${reg.body.data.id}/receipt`,
			tokens.s1,
		);
		assert.equal(receipt.status, 200);
		assert.equal(receipt.body.data.payment, null);
	});
});

describe("admin management and reporting", () => {
	test("admin lists and filters registrations; students cannot use the admin list", async () => {
		const all = await api(
			"GET",
			`/registrations?semesterId=${semesterId}&limit=100`,
			tokens.admin,
		);
		assert.equal(all.status, 200);
		assert.ok(all.body.data.length >= 5);
		const confirmed = await api(
			"GET",
			`/registrations?semesterId=${semesterId}&status=CONFIRMED&limit=100`,
			tokens.admin,
		);
		assert.ok(
			confirmed.body.data.every(
				(r: { status: string }) => r.status === "CONFIRMED",
			),
		);
		const paid = await api(
			"GET",
			`/registrations?semesterId=${semesterId}&paymentStatus=PAID&limit=100`,
			tokens.admin,
		);
		assert.ok(
			paid.body.data.every(
				(r: { invoice: { status: string } }) => r.invoice.status === "PAID",
			),
		);
		const dept = await api(
			"GET",
			`/registrations?semesterId=${semesterId}&departmentId=${otherDeptId}`,
			tokens.admin,
		);
		assert.equal(dept.body.data.length, 0);
		const search = await api(
			"GET",
			`/registrations?searchTerm=Student%20s1&semesterId=${semesterId}`,
			tokens.admin,
		);
		assert.ok(search.body.data.length >= 1);
		assert.equal(
			(await api("GET", "/registrations/stats", tokens.s1)).status,
			403,
		);
		assert.equal(
			(await api("GET", "/registrations/stats", tokens.teacher)).status,
			403,
		);
	});

	test("statistics add up", async () => {
		const stats = (
			await api(
				"GET",
				`/registrations/stats?semesterId=${semesterId}`,
				tokens.admin,
			)
		).body.data;
		const confirmed = await prisma.courseRegistration.count({
			where: { semesterId, status: "CONFIRMED" },
		});
		const paidInvoices = await prisma.registrationInvoice.aggregate({
			where: { semesterId, status: "PAID" },
			_sum: { totalAmount: true },
			_count: true,
		});
		assert.equal(stats.totalConfirmed, confirmed);
		assert.equal(stats.totalPaid, paidInvoices._count);
		assert.equal(stats.totalCollected, paidInvoices._sum.totalAmount);
		assert.ok(stats.totalUnpaid >= 1);
		assert.ok(stats.totalRegisteredCredits > 0);
		assert.equal(
			stats.totalRegisteredStudents,
			(
				await prisma.courseRegistration.groupBy({
					by: ["studentId"],
					where: { semesterId, status: "CONFIRMED" },
				})
			).length,
		);
	});

	test("an admin can reject an unpaid registration, but not a paid one", async () => {
		const reg = await prisma.courseRegistration.findFirstOrThrow({
			where: { semesterId, status: "SUBMITTED" },
		});
		const res = await api(
			"POST",
			`/registrations/${reg.id}/cancel`,
			tokens.admin,
			{ reject: true, reason: "not eligible" },
		);
		assert.equal(res.status, 200);
		assert.equal(res.body.data.status, "REJECTED");
		const paid = await prisma.courseRegistration.findFirstOrThrow({
			where: { semesterId, status: "CONFIRMED" },
		});
		assert.equal(
			(await api("POST", `/registrations/${paid.id}/cancel`, tokens.admin, {}))
				.status,
			409,
		);
		// a student cannot use the admin-only reject flag
		const own = await register("s9", ["C3", "C8"]);
		const cancel = await api(
			"POST",
			`/registrations/${own.body.data.id}/cancel`,
			tokens.s9,
			{ reject: true },
		);
		assert.equal(cancel.body.data.status, "CANCELLED");
	});

	test("the audit log records the important events", async () => {
		const actions = new Set(
			(
				await prisma.auditLog.findMany({
					select: { action: true },
					where: { createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
				})
			).map((a) => a.action),
		);
		for (const a of [
			"REGISTRATION_SETTING_UPDATED",
			"REGISTRATION_SUBMITTED",
			"INVOICE_CREATED",
			"PAYMENT_INITIATED",
			"PAYMENT_COMPLETED",
			"REGISTRATION_CONFIRMED",
			"REGISTRATION_CANCELLED",
		]) {
			assert.ok(actions.has(a), `missing audit event ${a}`);
		}
	});
});
