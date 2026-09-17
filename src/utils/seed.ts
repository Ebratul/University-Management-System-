import { Role, SemesterStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

import config from "../config/index.js";
import { prisma } from "../lib/prisma.js";

const requireEnv = (value: string | undefined, name: string): string => {
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
};

const getSaltRounds = (): number => {
	const value = Number(
		requireEnv(config.bcrypt_salt_rounds, "BCRYPT_SALT_ROUNDS"),
	);

	if (!Number.isInteger(value) || value < 4 || value > 31) {
		throw new Error("BCRYPT_SALT_ROUNDS must be an integer between 4 and 31");
	}

	return value;
};

const hashPassword = async (password: string) =>
	bcrypt.hash(password, getSaltRounds());

const getDefaultDepartment = async () =>
	prisma.department.upsert({
		where: { code: "CSE" },
		update: {},
		create: {
			name: "Computer Science and Engineering",
			code: "CSE",
		},
	});

const getDefaultSemester = async () =>
	prisma.semester.upsert({
		where: { code: "FALL-2026" },
		update: {},
		create: {
			year: 2026,
			code: "FALL-2026",
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			endDate: new Date("2026-12-31T23:59:59.000Z"),
			status: SemesterStatus.ONGOING,
		},
	});

export const seedSuperAdmin = async () => {
	const email = requireEnv(
		config.super_admin.email,
		"SUPER_ADMIN_EMAIL",
	).toLowerCase();
	const existingUser = await prisma.user.findUnique({ where: { email } });

	if (existingUser) {
		console.log(`Super admin already exists: ${email}`);
		return existingUser;
	}

	const name = requireEnv(config.super_admin.name, "SUPER_ADMIN_NAME");
	const password = requireEnv(
		config.super_admin.password,
		"SUPER_ADMIN_PASSWORD",
	);
	const hashedPassword = await hashPassword(password);
	const user = await prisma.user.create({
		data: {
			email,
			password: hashedPassword,
			role: Role.ADMIN,
			admin: {
				create: { name },
			},
		},
		include: { admin: true },
	});

	console.log(`Created super admin: ${user.email}`);
	return user;
};

export const seedTesterAdmin = async () => {
	const email = requireEnv(
		config.tester_admin.email,
		"TESTER_ADMIN_EMAIL",
	).toLowerCase();
	const existingUser = await prisma.user.findUnique({ where: { email } });

	if (existingUser) {
		console.log(`Tester admin already exists: ${email}`);
		return existingUser;
	}

	const name = requireEnv(config.tester_admin.name, "TESTER_ADMIN_NAME");
	const password = requireEnv(
		config.tester_admin.password,
		"TESTER_ADMIN_PASSWORD",
	);
	const hashedPassword = await hashPassword(password);
	const user = await prisma.user.create({
		data: {
			email,
			password: hashedPassword,
			role: Role.ADMIN,
			admin: {
				create: { name },
			},
		},
		include: { admin: true },
	});

	console.log(`Created tester admin: ${user.email}`);
	return user;
};

export const seedTesterFaculty = async () => {
	const email = requireEnv(
		config.tester_faculty.email,
		"TESTER_FACULTY_EMAIL",
	).toLowerCase();
	const existingUser = await prisma.user.findUnique({ where: { email } });

	if (existingUser) {
		console.log(`Tester faculty already exists: ${email}`);
		return existingUser;
	}

	const name = requireEnv(config.tester_faculty.name, "TESTER_FACULTY_NAME");
	const password = requireEnv(
		config.tester_faculty.password,
		"TESTER_FACULTY_PASSWORD",
	);
	const department = await getDefaultDepartment();
	const hashedPassword = await hashPassword(password);
	const user = await prisma.user.create({
		data: {
			email,
			password: hashedPassword,
			role: Role.FACULTY,
			faculty: {
				create: {
					facultyId: "FAC-TEST-001",
					name,
					designation: "Assistant Professor",
					department: { connect: { id: department.id } },
				},
			},
		},
		include: { faculty: true },
	});

	console.log(`Created tester faculty: ${user.email}`);
	return user;
};

export const seedTesterStudent = async () => {
	const email = requireEnv(
		config.tester_student.email,
		"TESTER_STUDENT_EMAIL",
	).toLowerCase();
	const existingUser = await prisma.user.findUnique({ where: { email } });

	if (existingUser) {
		console.log(`Tester student already exists: ${email}`);
		return existingUser;
	}

	const name = requireEnv(config.tester_student.name, "TESTER_STUDENT_NAME");
	const password = requireEnv(
		config.tester_student.password,
		"TESTER_STUDENT_PASSWORD",
	);
	const [department, semester] = await Promise.all([
		getDefaultDepartment(),
		getDefaultSemester(),
	]);
	const hashedPassword = await hashPassword(password);
	const user = await prisma.user.create({
		data: {
			email,
			password: hashedPassword,
			role: Role.STUDENT,
			student: {
				create: {
					studentId: "STU-TEST-001",
					name,
					department: { connect: { id: department.id } },
					admissionSemester: { connect: { id: semester.id } },
				},
			},
		},
		include: { student: true },
	});

	console.log(`Created tester student: ${user.email}`);
	return user;
};

export const seedAll = async () => {
	await seedSuperAdmin();
	await seedTesterAdmin();
	await seedTesterFaculty();
	await seedTesterStudent();
};

seedAll()
	.then(async () => {
		console.log("Database seeding completed successfully");
		await prisma.$disconnect();
	})
	.catch(async (error: unknown) => {
		console.error("Database seeding failed:", error);
		await prisma.$disconnect();
		process.exitCode = 1;
	});
