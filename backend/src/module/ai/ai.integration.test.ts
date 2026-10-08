import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, beforeEach, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import app from "../../app";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { aiGenerationLimiter } from "../../middleware/rateLimiter";

// Integration test (real Prisma + Postgres via DATABASE_URL). The Python RAG
// service is replaced by a tiny local HTTP server so we can check exactly what
// the Node API sends it and how it reacts to each kind of reply.

const suffix = Date.now().toString();
const PASSWORD = "Password1!";

let apiServer: Server;
let ragServer: Server;
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
let offeringB = "";
let materialA = "";
let materialB = "";

// What the fake RAG service will do on the next call, and what it received.
let ragReply: { status: number; body: unknown } = { status: 200, body: {} };
// biome-ignore lint/suspicious/noExplicitAny: test helper reads loosely-typed JSON
let ragSeen: { headers: Record<string, unknown>; body: any } | null = null;
let ragCalls = 0;

const goodQuestion = (n: number) => ({
	question: `What does the material say about topic ${n}?`,
	options: { A: `a${n}`, B: `b${n}`, C: `c${n}`, D: `d${n}` },
	correct_answer: "C",
	explanation: `Because of c${n}.`,
	source_reference: `Page ${n}`,
});

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
const generate = (token: string | null, extra: Record<string, unknown> = {}) =>
	api("POST", "/ai/quiz/generate", token, {
		offeringId: offeringA,
		materialId: materialA,
		numberOfQuestions: 3,
		difficulty: "easy",
		...extra,
	});

const makeUser = async (label: string, role: "FACULTY" | "STUDENT") => {
	const hashed = await bcrypt.hash(PASSWORD, Number(config.bcrypt_salt_rounds));
	const email = `ai.${label}.${suffix}@example.com`.toLowerCase();
	const user = await prisma.user.create({
		data: {
			email,
			password: hashed,
			role,
			...(role === "FACULTY"
				? {
						faculty: {
							create: {
								facultyId: `AI-FAC-${label}-${suffix}`,
								name: `Teacher ${label}`,
								departmentId: ids.departmentId,
							},
						},
					}
				: {
						student: {
							create: {
								studentId: `AI-STU-${label}-${suffix}`,
								registrationNumber: `AI-REG-${label}-${suffix}`.toUpperCase(),
								name: `Student ${label}`,
								departmentId: ids.departmentId,
								admissionSemesterId: ids.semesterId,
							},
						},
					}),
		},
		include: { student: true, faculty: true },
	});
	ids.userIds.push(user.id);
	profile[label] = (user.student?.id ?? user.faculty?.id) as string;
	const res = await api("POST", "/auth/login", null, {
		email,
		password: PASSWORD,
	});
	assert.equal(res.status, 200);
	tokens[label] = res.body.data.accessToken;
	return user;
};

const makeOffering = async (tag: string, facultyId: string) => {
	const course = await prisma.course.create({
		data: {
			courseCode: `AI${tag}${suffix}`.slice(0, 20),
			title: `AI Course ${tag}`,
			credits: 3,
			departmentId: ids.departmentId,
		},
	});
	ids.courseIds.push(course.id);
	const offering = await prisma.courseOffering.create({
		data: { courseId: course.id, facultyId, semesterId: ids.semesterId },
	});
	ids.offeringIds.push(offering.id);
	return offering.id;
};

const makeMaterial = async (offeringId: string, uploadedById: string) =>
	(
		await prisma.courseMaterial.create({
			data: {
				title: "Lecture 1",
				fileName: "lecture1.pdf",
				fileSize: 1000,
				publicId: `ums/_aitest/${suffix}-${offeringId}.pdf`,
				courseOfferingId: offeringId,
				uploadedById,
			},
		})
	).id;

before(async () => {
	await new Promise<void>((resolve) => {
		apiServer = app.listen(0, resolve);
	});
	const address = apiServer.address();
	if (!address || typeof address === "string") throw new Error("bind failed");
	baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

	await new Promise<void>((resolve) => {
		ragServer = createServer((req, res) => {
			ragCalls += 1;
			let raw = "";
			req.on("data", (chunk) => {
				raw += chunk;
			});
			req.on("end", () => {
				ragSeen = { headers: req.headers, body: JSON.parse(raw || "{}") };
				res.writeHead(ragReply.status, { "Content-Type": "application/json" });
				res.end(JSON.stringify(ragReply.body));
			});
		}).listen(0, resolve);
	});
	const ragAddress = ragServer.address();
	if (!ragAddress || typeof ragAddress === "string")
		throw new Error("bind failed");
	config.rag_service_url = `http://127.0.0.1:${ragAddress.port}`;
	config.rag_service_token = "test-internal-token";
	config.rag_service_timeout_ms = 3000;

	const department = await prisma.department.create({
		data: { name: `AI Dept ${suffix}`, code: `AI${suffix}`.slice(0, 20) },
	});
	ids.departmentId = department.id;
	const semester = await prisma.semester.create({
		data: {
			year: 2097,
			code: `AI-SEM-${suffix}`,
			startDate: new Date("2097-01-01"),
			endDate: new Date("2097-05-01"),
			status: "ONGOING",
		},
	});
	ids.semesterId = semester.id;

	const teacherA = await makeUser("teacherA", "FACULTY");
	const teacherB = await makeUser("teacherB", "FACULTY");
	await makeUser("student", "STUDENT");

	offeringA = await makeOffering("A", profile.teacherA);
	offeringB = await makeOffering("B", profile.teacherB);
	materialA = await makeMaterial(offeringA, teacherA.id);
	materialB = await makeMaterial(offeringB, teacherB.id);
	await prisma.enrollment.create({
		data: {
			studentId: profile.student,
			courseOfferingId: offeringA,
			status: "ENROLLED",
		},
	});
});

after(async () => {
	const offerings = { courseOfferingId: { in: ids.offeringIds } };
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
	await new Promise<void>((resolve) => apiServer.close(() => resolve()));
	await new Promise<void>((resolve) => ragServer.close(() => resolve()));
	await prisma.$disconnect();
});

describe("POST /ai/quiz/generate", () => {
	// Every request below comes from 127.0.0.1; start each test with a clean
	// allowance (the limit itself is checked in the last test).
	beforeEach(async () => {
		for (const key of ["127.0.0.1", "::ffff:127.0.0.1", "::1"]) {
			await aiGenerationLimiter.resetKey(key);
		}
	});

	test("teacher gets reviewable questions; the RAG service gets a signed URL and the shared secret", async () => {
		ragReply = {
			status: 200,
			body: {
				questions: [goodQuestion(1), goodQuestion(2), goodQuestion(3)],
				warnings: [],
			},
		};
		const res = await generate(tokens.teacherA);
		assert.equal(res.status, 200);
		assert.equal(res.body.data.questions.length, 3);
		assert.deepEqual(Object.keys(res.body.data.questions[0]).sort(), [
			"correctAnswer",
			"explanation",
			"optionA",
			"optionB",
			"optionC",
			"optionD",
			"question",
			"sourceReference",
		]);
		assert.equal(res.body.data.questions[0].correctAnswer, "C");

		assert.ok(ragSeen);
		assert.equal(ragSeen.headers["x-internal-token"], "test-internal-token");
		assert.equal(ragSeen.body.course_id, offeringA);
		assert.equal(ragSeen.body.material_id, materialA);
		assert.equal(ragSeen.body.number_of_questions, 3);
		assert.equal(ragSeen.body.difficulty, "easy");
		const url = new URL(ragSeen.body.document_url);
		assert.equal(url.protocol, "https:");
		assert.ok(url.searchParams.get("signature"), "the PDF link must be signed");
		assert.ok(url.searchParams.get("expires_at"), "and must expire");
		// Nothing is saved by generation: the teacher reviews first.
		assert.equal(
			await prisma.quiz.count({ where: { courseOfferingId: offeringA } }),
			0,
		);
	});

	test("a teacher cannot generate from someone else's course or material", async () => {
		ragCalls = 0;
		assert.equal((await generate(tokens.teacherB)).status, 403);
		const crossMaterial = await generate(tokens.teacherA, {
			materialId: materialB,
		});
		assert.equal(crossMaterial.status, 404);
		assert.equal(
			ragCalls,
			0,
			"the AI service must not be called for refused requests",
		);
	});

	test("students and anonymous users are refused", async () => {
		ragCalls = 0;
		assert.equal((await generate(tokens.student)).status, 403);
		assert.equal((await generate(null)).status, 401);
		assert.equal(ragCalls, 0);
	});

	test("input is validated", async () => {
		assert.equal(
			(await generate(tokens.teacherA, { numberOfQuestions: 500 })).status,
			400,
		);
		assert.equal(
			(await generate(tokens.teacherA, { difficulty: "impossible" })).status,
			400,
		);
		assert.equal(
			(await generate(tokens.teacherA, { materialId: "nope" })).status,
			400,
		);
	});

	test("'insufficient information' from the model is passed on as 422", async () => {
		ragReply = {
			status: 422,
			body: {
				code: "INSUFFICIENT_CONTEXT",
				message:
					"Insufficient information in the provided material to generate a reliable question.",
			},
		};
		const res = await generate(tokens.teacherA);
		assert.equal(res.status, 422);
		assert.match(res.body.message, /Insufficient information/);
	});

	test("internal failures are hidden behind a generic message", async () => {
		ragReply = { status: 401, body: { detail: "Unauthorized" } };
		const bad = await generate(tokens.teacherA);
		assert.equal(bad.status, 502);
		assert.ok(!JSON.stringify(bad.body).includes("Unauthorized"));

		ragReply = {
			status: 500,
			body: { code: "GENERATION_FAILED", message: "stack trace here" },
		};
		assert.equal((await generate(tokens.teacherA)).status, 502);
	});

	test("malformed or invalid generated questions are discarded", async () => {
		const sameOptions = {
			...goodQuestion(9),
			options: { A: "x", B: "x", C: "y", D: "z" },
		};
		ragReply = {
			status: 200,
			body: {
				questions: [goodQuestion(1), sameOptions],
				warnings: ["thin material"],
			},
		};
		const res = await generate(tokens.teacherA);
		assert.equal(res.status, 200);
		assert.equal(res.body.data.questions.length, 1);
		assert.ok(res.body.data.warnings.some((w: string) => /discarded/.test(w)));
		assert.ok(res.body.data.warnings.includes("thin material"));

		ragReply = { status: 200, body: { nonsense: true } };
		assert.equal((await generate(tokens.teacherA)).status, 502);

		ragReply = { status: 200, body: { questions: [sameOptions] } };
		assert.equal((await generate(tokens.teacherA)).status, 502);
	});

	test("an unreachable or unconfigured AI service gives 503", async () => {
		const original = config.rag_service_url;
		config.rag_service_url = "http://127.0.0.1:1"; // nothing listens here
		assert.equal((await generate(tokens.teacherA)).status, 503);
		config.rag_service_url = "";
		assert.equal((await generate(tokens.teacherA)).status, 503);
		config.rag_service_url = original;
	});

	test("generation is rate limited per client", async () => {
		ragReply = {
			status: 200,
			body: { questions: [goodQuestion(1)], warnings: [] },
		};
		const statuses: number[] = [];
		for (let i = 0; i < 12; i++)
			statuses.push((await generate(tokens.teacherA)).status);
		assert.equal(statuses.filter((s) => s === 200).length, 10);
		assert.deepEqual(statuses.slice(10), [429, 429]);
	});
});
