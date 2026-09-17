import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import bcrypt from "bcryptjs";
import app from "../../app";
import config from "../../config";
import { prisma } from "../../lib/prisma";

// Exercises the Serializable-transaction seat-limit guard in
// enrollment.service.ts against the real database: two students racing for
// the single seat on a course offering must not both win. This is an
// integration test (real Prisma + real Postgres), not a unit test — it
// needs DATABASE_URL to point at a reachable database.

let server: Server;
let baseUrl: string;

const cleanupIds: {
	userIds: string[];
	departmentId?: string;
	semesterId?: string;
	courseId?: string;
	facultyId?: string;
	offeringId?: string;
} = { userIds: [] };

before(async () => {
	await new Promise<void>((resolve) => {
		server = app.listen(0, resolve);
	});
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Failed to bind test server");
	baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
});

after(async () => {
	const { userIds, departmentId, semesterId, courseId, facultyId, offeringId } =
		cleanupIds;

	if (offeringId) {
		await prisma.enrollment.deleteMany({
			where: { courseOfferingId: offeringId },
		});
		await prisma.courseOffering.deleteMany({ where: { id: offeringId } });
	}
	if (facultyId) await prisma.faculty.deleteMany({ where: { id: facultyId } });
	if (userIds.length) {
		await prisma.refreshToken.deleteMany({
			where: { userId: { in: userIds } },
		});
		await prisma.student.deleteMany({ where: { userId: { in: userIds } } });
		await prisma.user.deleteMany({ where: { id: { in: userIds } } });
	}
	if (courseId) await prisma.course.deleteMany({ where: { id: courseId } });
	if (semesterId)
		await prisma.semester.deleteMany({ where: { id: semesterId } });
	if (departmentId)
		await prisma.department.deleteMany({ where: { id: departmentId } });

	await new Promise<void>((resolve) => server.close(() => resolve()));
	await prisma.$disconnect();
});

test("only one of two concurrent enrollments wins the last seat", async () => {
	const suffix = Date.now().toString();
	const hashedPassword = await bcrypt.hash(
		"Password1!",
		Number(config.bcrypt_salt_rounds),
	);

	const department = await prisma.department.create({
		data: {
			name: `Race Test Dept ${suffix}`,
			code: `RACE${suffix}`.slice(0, 20),
		},
	});
	cleanupIds.departmentId = department.id;

	const semester = await prisma.semester.create({
		data: {
			year: 2099,
			code: `RACE-SEM-${suffix}`,
			startDate: new Date("2099-01-01"),
			endDate: new Date("2099-05-01"),
			status: "ONGOING",
		},
	});
	cleanupIds.semesterId = semester.id;

	const course = await prisma.course.create({
		data: {
			courseCode: `RACE${suffix}`.slice(0, 20),
			title: "Race Condition Test Course",
			credits: 3,
			departmentId: department.id,
		},
	});
	cleanupIds.courseId = course.id;

	const facultyUser = await prisma.user.create({
		data: {
			email: `race.faculty.${suffix}@example.com`,
			password: hashedPassword,
			role: "FACULTY",
			faculty: {
				create: {
					facultyId: `RACE-FAC-${suffix}`,
					name: "Race Faculty",
					departmentId: department.id,
				},
			},
		},
		include: { faculty: true },
	});
	cleanupIds.userIds.push(facultyUser.id);
	assert.ok(
		facultyUser.faculty,
		"faculty profile must be created alongside the user",
	);
	cleanupIds.facultyId = facultyUser.faculty.id;

	const offering = await prisma.courseOffering.create({
		data: {
			courseId: course.id,
			facultyId: facultyUser.faculty.id,
			semesterId: semester.id,
			maxSeats: 1,
		},
	});
	cleanupIds.offeringId = offering.id;

	const [studentAUser, studentBUser] = await Promise.all(
		["a", "b"].map((label) =>
			prisma.user.create({
				data: {
					email: `race.student.${label}.${suffix}@example.com`,
					password: hashedPassword,
					role: "STUDENT",
					student: {
						create: {
							studentId: `RACE-STU-${label}-${suffix}`,
							name: `Race Student ${label}`,
							departmentId: department.id,
							admissionSemesterId: semester.id,
						},
					},
				},
			}),
		),
	);
	cleanupIds.userIds.push(studentAUser.id, studentBUser.id);

	const login = async (email: string) => {
		const res = await fetch(`${baseUrl}/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password: "Password1!" }),
		});
		const body = (await res.json()) as { data: { accessToken: string } };
		return body.data.accessToken;
	};

	const [tokenA, tokenB] = await Promise.all([
		login(studentAUser.email),
		login(studentBUser.email),
	]);

	const enroll = (token: string) =>
		fetch(`${baseUrl}/enrollments`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ courseOfferingId: offering.id }),
		});

	const [resA, resB] = await Promise.all([enroll(tokenA), enroll(tokenB)]);
	const statuses = [resA.status, resB.status].sort();

	assert.deepEqual(
		statuses,
		[201, 409],
		`expected exactly one 201 (enrolled) and one 409 (no seats), got ${statuses.join(", ")}`,
	);

	const enrolledCount = await prisma.enrollment.count({
		where: {
			courseOfferingId: offering.id,
			status: { in: ["PENDING", "ENROLLED"] },
		},
	});
	assert.equal(
		enrolledCount,
		1,
		"the offering must never end up with more active enrollments than maxSeats",
	);
});
