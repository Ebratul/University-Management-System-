import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import app from "../../app";
import config from "../../config";
import { prisma } from "../../lib/prisma";

// Integration test (real Prisma + real Postgres, needs DATABASE_URL): course
// access control, the 5-course limit, attendance, and the quiz lifecycle with
// its server-enforced timer. "Time passing" is simulated by moving the quiz's
// endsAt into the past in the database.

const suffix = Date.now().toString();
const PASSWORD = "Password1!";

let server: Server;
let baseUrl: string;

const ids = {
	userIds: [] as string[],
	courseIds: [] as string[],
	offeringIds: [] as string[],
	departmentId: "",
	semesterId: "",
};
const tokens: Record<string, string> = {};
const profile: Record<string, string> = {};
let offeringA = "";
let quizId = "";
let questionIds: string[] = [];

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

const makeUser = async (
	label: string,
	role: "ADMIN" | "FACULTY" | "STUDENT",
) => {
	const hashed = await bcrypt.hash(PASSWORD, Number(config.bcrypt_salt_rounds));
	const email = `quiz.${label}.${suffix}@example.com`.toLowerCase();
	const user = await prisma.user.create({
		data: {
			email,
			password: hashed,
			role,
			...(role === "FACULTY"
				? {
						faculty: {
							create: {
								facultyId: `QZ-FAC-${label}-${suffix}`,
								name: `Teacher ${label}`,
								departmentId: ids.departmentId,
							},
						},
					}
				: {}),
			...(role === "STUDENT"
				? {
						student: {
							create: {
								studentId: `QZ-STU-${label}-${suffix}`,
								registrationNumber: `REG-${label}-${suffix}`.toUpperCase(),
								name: `Student ${label}`,
								departmentId: ids.departmentId,
								admissionSemesterId: ids.semesterId,
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
	assert.equal(res.status, 200, `login ${label}: ${JSON.stringify(res.body)}`);
	tokens[label] = res.body.data.accessToken;
};

const makeCourse = async (tag: string) => {
	const course = await prisma.course.create({
		data: {
			courseCode: `QZ${tag}${suffix}`.slice(0, 20),
			title: `Quiz Test Course ${tag}`,
			credits: 3,
			departmentId: ids.departmentId,
		},
	});
	ids.courseIds.push(course.id);
	return course.id;
};

const makeOffering = async (courseId: string, facultyId: string) => {
	const offering = await prisma.courseOffering.create({
		data: { courseId, facultyId, semesterId: ids.semesterId },
	});
	ids.offeringIds.push(offering.id);
	return offering.id;
};

const enrol = (studentId: string, offeringId: string) =>
	prisma.enrollment.create({
		data: { studentId, courseOfferingId: offeringId, status: "ENROLLED" },
	});

const question = (n: number) => ({
	question: `What is statement number ${n}?`,
	optionA: `A${n}`,
	optionB: `B${n}`,
	optionC: `C${n}`,
	optionD: `D${n}`,
	correctAnswer: "B",
	explanation: `Because B${n}`,
	sourceReference: `p.${n}`,
});

before(async () => {
	await new Promise<void>((resolve) => {
		server = app.listen(0, resolve);
	});
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("bind failed");
	baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

	const department = await prisma.department.create({
		data: { name: `Quiz Dept ${suffix}`, code: `QZ${suffix}`.slice(0, 20) },
	});
	ids.departmentId = department.id;
	const semester = await prisma.semester.create({
		data: {
			year: 2098,
			code: `QZ-SEM-${suffix}`,
			startDate: new Date("2098-01-01"),
			endDate: new Date("2098-05-01"),
			status: "ONGOING",
		},
	});
	ids.semesterId = semester.id;

	for (const [label, role] of [
		["admin", "ADMIN"],
		["teacherA", "FACULTY"],
		["teacherB", "FACULTY"],
		["s1", "STUDENT"],
		["s2", "STUDENT"],
		["s3", "STUDENT"], // never enrolled anywhere
	] as const) {
		await makeUser(label, role);
	}

	offeringA = await makeOffering(await makeCourse("A"), profile.teacherA);
	await makeOffering(await makeCourse("B"), profile.teacherB);
	await enrol(profile.s1, offeringA);
	await enrol(profile.s2, offeringA);
});

after(async () => {
	const offerings = { courseOfferingId: { in: ids.offeringIds } };
	await prisma.quiz.deleteMany({
		where: { courseOfferingId: { in: ids.offeringIds } },
	});
	await prisma.attendance.deleteMany({ where: offerings });
	await prisma.courseMaterial.deleteMany({ where: offerings });
	await prisma.enrollment.deleteMany({ where: offerings });
	await prisma.courseOffering.deleteMany({
		where: { id: { in: ids.offeringIds } },
	});
	await prisma.refreshToken.deleteMany({
		where: { userId: { in: ids.userIds } },
	});
	await prisma.student.deleteMany({ where: { userId: { in: ids.userIds } } });
	await prisma.faculty.deleteMany({ where: { userId: { in: ids.userIds } } });
	await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
	await prisma.course.deleteMany({ where: { id: { in: ids.courseIds } } });
	await prisma.semester.deleteMany({ where: { id: ids.semesterId } });
	await prisma.department.deleteMany({ where: { id: ids.departmentId } });
	await new Promise<void>((resolve) => server.close(() => resolve()));
	await prisma.$disconnect();
});

describe("teacher course limit", () => {
	test("a faculty can be assigned 5 courses, the 6th is rejected", async () => {
		// teacherA already has offeringA (1 of 5). Admin assigns 4 more.
		for (let i = 1; i <= 4; i++) {
			const courseId = await makeCourse(`L${i}`);
			const res = await api("POST", "/course-offerings", tokens.admin, {
				courseId,
				facultyId: profile.teacherA,
				semesterId: ids.semesterId,
			});
			assert.equal(res.status, 201, `assignment ${i + 1} should succeed`);
			ids.offeringIds.push(res.body.data.id);
		}
		const sixth = await api("POST", "/course-offerings", tokens.admin, {
			courseId: await makeCourse("L5"),
			facultyId: profile.teacherA,
			semesterId: ids.semesterId,
		});
		assert.equal(sixth.status, 409);
		assert.match(sixth.body.message, /maximum limit of 5 courses/);
	});
});

describe("course access control", () => {
	test("only the teacher / enrolled students / admin can read a course", async () => {
		const path = `/course-offerings/${offeringA}/materials`;
		assert.equal((await api("GET", path, tokens.teacherA)).status, 200);
		assert.equal((await api("GET", path, tokens.s1)).status, 200);
		assert.equal((await api("GET", path, tokens.admin)).status, 200);
		assert.equal((await api("GET", path, tokens.teacherB)).status, 403);
		assert.equal((await api("GET", path, tokens.s3)).status, 403);
		assert.equal((await api("GET", path, null)).status, 401);
	});

	test("a student cannot upload materials", async () => {
		const res = await fetch(
			`${baseUrl}/course-offerings/${offeringA}/materials`,
			{
				method: "POST",
				headers: { Authorization: `Bearer ${tokens.s1}` },
			},
		);
		assert.equal(res.status, 403);
	});
});

describe("attendance", () => {
	const path = () => `/course-offerings/${offeringA}/attendance`;

	test("teacher marks attendance; re-marking a day updates, never duplicates", async () => {
		const day = new Date().toISOString().slice(0, 10);
		const mark = (s2: string) =>
			api("POST", path(), tokens.teacherA, {
				date: day,
				records: [
					{ studentId: profile.s1, status: "PRESENT" },
					{ studentId: profile.s2, status: s2 },
				],
			});
		assert.equal((await mark("ABSENT")).status, 200);
		assert.equal((await mark("PRESENT")).status, 200);
		assert.equal(
			await prisma.attendance.count({ where: { courseOfferingId: offeringA } }),
			2,
		);

		// a second class day
		const earlier = new Date(Date.now() - 86_400_000)
			.toISOString()
			.slice(0, 10);
		await api("POST", path(), tokens.teacherA, {
			date: earlier,
			records: [
				{ studentId: profile.s1, status: "PRESENT" },
				{ studentId: profile.s2, status: "ABSENT" },
			],
		});

		const me = await api("GET", `${path()}/me`, tokens.s2);
		assert.equal(me.status, 200);
		assert.equal(me.body.data.totalClasses, 2);
		assert.equal(me.body.data.present, 1);
		assert.equal(me.body.data.percentage, 50);
	});

	test("rejects non-enrolled students, future dates and other teachers", async () => {
		const day = new Date().toISOString().slice(0, 10);
		const outsider = await api("POST", path(), tokens.teacherA, {
			date: day,
			records: [{ studentId: profile.s3, status: "PRESENT" }],
		});
		assert.equal(outsider.status, 400);

		const future = await api("POST", path(), tokens.teacherA, {
			date: "2999-01-01",
			records: [{ studentId: profile.s1, status: "PRESENT" }],
		});
		assert.equal(future.status, 400);

		const other = await api("POST", path(), tokens.teacherB, {
			date: day,
			records: [{ studentId: profile.s1, status: "PRESENT" }],
		});
		assert.equal(other.status, 403);

		assert.equal(
			(await api("GET", `${path()}/summary`, tokens.s1)).status,
			403,
		);
		assert.equal((await api("GET", `${path()}/me`, tokens.s3)).status, 403);
	});
});

describe("quiz lifecycle", () => {
	const quizPath = () => `/quizzes/${quizId}`;

	test("validation: four distinct options are required", async () => {
		const res = await api(
			"POST",
			`/course-offerings/${offeringA}/quizzes`,
			tokens.teacherA,
			{
				title: "Bad quiz",
				durationMinutes: 10,
				questions: [{ ...question(1), optionC: "A1" }],
			},
		);
		assert.equal(res.status, 400);
	});

	test("teacher creates a DRAFT quiz; students cannot see it or start it", async () => {
		const created = await api(
			"POST",
			`/course-offerings/${offeringA}/quizzes`,
			tokens.teacherA,
			{
				title: "Database Quiz",
				durationMinutes: 10,
				questions: [question(1), question(2), question(3)],
			},
		);
		assert.equal(created.status, 201);
		quizId = created.body.data.id;
		assert.equal(created.body.data.status, "DRAFT");
		questionIds = created.body.data.questions.map((q: { id: string }) => q.id);

		assert.equal((await api("GET", quizPath(), tokens.s1)).status, 404);
		assert.equal(
			(await api("POST", `${quizPath()}/start`, tokens.teacherA)).status,
			409,
		);
		assert.equal(
			(await api("POST", `${quizPath()}/start`, tokens.s1)).status,
			403,
		);
		assert.equal((await api("GET", quizPath(), tokens.teacherB)).status, 403);

		const list = await api(
			"GET",
			`/course-offerings/${offeringA}/quizzes`,
			tokens.s1,
		);
		assert.equal(
			list.body.data.quizzes.length,
			0,
			"drafts are hidden from students",
		);
	});

	test("teacher can edit questions in DRAFT, then publish", async () => {
		const edited = await api(
			"PUT",
			`${quizPath()}/questions`,
			tokens.teacherA,
			{
				questions: [question(1), question(2), question(3)],
			},
		);
		assert.equal(edited.status, 200);
		questionIds = edited.body.data.questions.map((q: { id: string }) => q.id);
		assert.equal(questionIds.length, 3);

		const published = await api(
			"POST",
			`${quizPath()}/publish`,
			tokens.teacherA,
		);
		assert.equal(published.body.data.status, "UPCOMING");
		// no longer editable once published
		assert.equal(
			(
				await api("PUT", `${quizPath()}/questions`, tokens.teacherA, {
					questions: [question(9)],
				})
			).status,
			409,
		);
	});

	test("students cannot open the quiz before the teacher starts it", async () => {
		const res = await api("POST", `${quizPath()}/attempt`, tokens.s1);
		assert.equal(res.status, 409);
		assert.match(res.body.message, /not started/);
	});

	test("starting sets endsAt from the server clock", async () => {
		const before = Date.now();
		const started = await api("POST", `${quizPath()}/start`, tokens.teacherA);
		assert.equal(started.body.data.status, "ACTIVE");
		const ends = Date.parse(started.body.data.endsAt);
		assert.ok(Math.abs(ends - (before + 10 * 60_000)) < 5_000);
		assert.equal(
			(await api("POST", `${quizPath()}/start`, tokens.teacherA)).status,
			409,
		);
	});

	test("the attempt never exposes the answer key; non-members are refused", async () => {
		const begun = await api("POST", `${quizPath()}/attempt`, tokens.s1);
		assert.equal(begun.status, 200);
		assert.equal(begun.body.data.questions.length, 3);
		const raw = JSON.stringify(begun.body.data);
		assert.ok(!raw.includes("correctAnswer"));
		assert.ok(!raw.includes("explanation"));
		assert.ok(!raw.includes("sourceReference"));

		const asStudentView = await api("GET", quizPath(), tokens.s1);
		assert.ok(
			!JSON.stringify(asStudentView.body.data).includes("correctAnswer"),
		);

		assert.equal(
			(await api("POST", `${quizPath()}/attempt`, tokens.s3)).status,
			403,
		);
		// resuming returns the same attempt
		const again = await api("POST", `${quizPath()}/attempt`, tokens.s1);
		assert.equal(again.body.data.attempt.id, begun.body.data.attempt.id);
	});

	test("submitting scores the attempt; the key stays hidden until the quiz ends", async () => {
		const submitted = await api("POST", `${quizPath()}/submit`, tokens.s1, {
			answers: [
				{ questionId: questionIds[0], selected: "B" },
				{ questionId: questionIds[1], selected: "B" },
				{ questionId: questionIds[2], selected: "A" },
			],
		});
		assert.equal(submitted.status, 200);
		assert.equal(submitted.body.data.score, 2);
		assert.equal(submitted.body.data.totalQuestions, 3);
		assert.equal(submitted.body.data.wrong, 1);
		assert.equal(submitted.body.data.percentage, 66.7);
		assert.equal(
			submitted.body.data.review,
			undefined,
			"no answer key while running",
		);

		const twice = await api("POST", `${quizPath()}/submit`, tokens.s1, {
			answers: [],
		});
		assert.equal(twice.status, 409);
	});

	test("rejects answers that belong to another quiz", async () => {
		await api("POST", `${quizPath()}/attempt`, tokens.s2);
		const res = await api("PUT", `${quizPath()}/attempt/answers`, tokens.s2, {
			answers: [
				{ questionId: "00000000-0000-4000-8000-000000000000", selected: "A" },
			],
		});
		assert.equal(res.status, 400);
	});

	test("after the deadline: late submit rejected, attempt auto-submitted, quiz closed", async () => {
		// s2 saved one correct answer before time ran out.
		const saved = await api("PUT", `${quizPath()}/attempt/answers`, tokens.s2, {
			answers: [{ questionId: questionIds[0], selected: "B" }],
		});
		assert.equal(saved.status, 200);

		// Time passes (server-side): the deadline is now in the past.
		await prisma.quiz.update({
			where: { id: quizId },
			data: { endsAt: new Date(Date.now() - 1_000) },
		});

		// The client still claims it is in time and sends better answers: ignored.
		const late = await api("POST", `${quizPath()}/submit`, tokens.s2, {
			answers: [
				{ questionId: questionIds[0], selected: "B" },
				{ questionId: questionIds[1], selected: "B" },
				{ questionId: questionIds[2], selected: "B" },
			],
		});
		assert.equal(late.status, 409);
		assert.match(late.body.message, /Time is over/);

		const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId } });
		assert.equal(quiz.status, "ENDED");
		const attempt = await prisma.quizAttempt.findFirstOrThrow({
			where: { quizId, studentId: profile.s2 },
		});
		assert.equal(attempt.status, "AUTO_SUBMITTED");
		assert.equal(attempt.score, 1, "only the answer saved in time counts");

		assert.equal(
			(await api("POST", `${quizPath()}/attempt`, tokens.s3)).status,
			403,
		);
		const save = await api("PUT", `${quizPath()}/attempt/answers`, tokens.s2, {
			answers: [],
		});
		assert.equal(save.status, 409);
	});

	test("once ended, the student sees the answer key and the teacher sees results", async () => {
		const mine = await api("GET", `${quizPath()}/my-result`, tokens.s1);
		assert.equal(mine.status, 200);
		assert.equal(mine.body.data.quizEnded, true);
		assert.equal(mine.body.data.review.length, 3);
		assert.equal(mine.body.data.review[0].correctAnswer, "B");
		assert.equal(mine.body.data.review[2].isCorrect, false);

		const results = await api(
			"GET",
			`${quizPath()}/results?sortBy=score&order=desc`,
			tokens.teacherA,
		);
		assert.equal(results.status, 200);
		assert.equal(results.body.data.summary.enrolled, 2);
		assert.equal(results.body.data.results[0].student.name, "Student s1");
		assert.equal(results.body.data.results[0].score, 2);
		assert.equal(results.body.data.results[1].status, "AUTO_SUBMITTED");

		const search = await api(
			"GET",
			`${quizPath()}/results?search=s2`,
			tokens.teacherA,
		);
		assert.equal(search.body.data.results.length, 1);

		assert.equal(
			(await api("GET", `${quizPath()}/results`, tokens.s1)).status,
			403,
		);
		assert.equal(
			(await api("GET", `${quizPath()}/results`, tokens.teacherB)).status,
			403,
		);
	});

	test("an ended quiz cannot be edited or deleted", async () => {
		assert.equal(
			(await api("DELETE", quizPath(), tokens.teacherA)).status,
			409,
		);
		assert.equal(
			(await api("PATCH", quizPath(), tokens.teacherA, { title: "Renamed" }))
				.status,
			409,
		);
	});
});
