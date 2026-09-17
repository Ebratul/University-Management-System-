import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { generateSequenceId } from "../../utils/generateId";
import { sha256 } from "../../utils/hash";
import { jwtUtils } from "../../utils/jwt";
import type {
	IGoogleLoginPayload,
	ILoginPayload,
	IRegisterPayload,
} from "./auth.interface";

type TSessionUser = { id: string; email: string; role: Role };

const getProfileName = async (userId: string, role: Role): Promise<string> => {
	if (role === Role.ADMIN) {
		const admin = await prisma.admin.findUnique({
			where: { userId },
			select: { name: true },
		});
		return admin?.name ?? "";
	}

	if (role === Role.FACULTY) {
		const faculty = await prisma.faculty.findUnique({
			where: { userId },
			select: { name: true },
		});
		return faculty?.name ?? "";
	}

	const student = await prisma.student.findUnique({
		where: { userId },
		select: { name: true },
	});
	return student?.name ?? "";
};

const issueAuthSession = async (user: TSessionUser, name: string) => {
	const jwtPayload = {
		userId: user.id,
		name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);
	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	const decoded = jwt.decode(refreshToken) as JwtPayload | null;
	const expiresAt = decoded?.exp
		? new Date(decoded.exp * 1000)
		: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

	await prisma.refreshToken.create({
		data: { token: sha256(refreshToken), userId: user.id, expiresAt },
	});

	return { accessToken, refreshToken };
};

const register = async (payload: IRegisterPayload) => {
	const email = payload.email.trim().toLowerCase();

	const existingUser = await prisma.user.findUnique({ where: { email } });
	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"An account with this email already exists.",
		);
	}

	const [department, semester] = await Promise.all([
		prisma.department.findFirst({
			where: { id: payload.departmentId, deletedAt: null },
		}),
		prisma.semester.findFirst({
			where: { id: payload.admissionSemesterId, deletedAt: null },
		}),
	]);

	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found.");
	}
	if (!semester) {
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found.");
	}

	const hashedPassword = await bcrypt.hash(
		payload.password,
		Number(config.bcrypt_salt_rounds),
	);
	const studentId = generateSequenceId("STU", semester.year);

	// Self-registration always creates a STUDENT account. Admin/Faculty accounts
	// are provisioned by an admin via the /faculties and /users endpoints.
	const user = await prisma.user.create({
		data: {
			email,
			password: hashedPassword,
			role: Role.STUDENT,
			student: {
				create: {
					studentId,
					name: payload.name,
					phone: payload.phone,
					dateOfBirth: payload.dateOfBirth,
					departmentId: department.id,
					admissionSemesterId: semester.id,
				},
			},
		},
		include: { student: true },
	});

	const tokens = await issueAuthSession(user, payload.name);

	await recordAuditLog({
		action: "USER_REGISTER",
		entityType: "User",
		entityId: user.id,
		description: `Student self-registered: ${email}`,
		actor: { userId: user.id, email: user.email, role: user.role },
	});

	return {
		user: {
			id: user.id,
			email: user.email,
			role: user.role,
			student: user.student,
		},
		...tokens,
	};
};

const login = async (payload: ILoginPayload) => {
	const email = payload.email.trim().toLowerCase();
	const user = await prisma.user.findFirst({
		where: { email, deletedAt: null },
	});

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
	}

	if (!user.isActive) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Your account has been deactivated. Please contact support.",
		);
	}

	if (!user.password) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This account uses Google Sign-In. Please continue with Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(
		payload.password,
		user.password,
	);
	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
	}

	const name = await getProfileName(user.id, user.role);
	const tokens = await issueAuthSession(user, name);

	await recordAuditLog({
		action: "USER_LOGIN",
		entityType: "User",
		entityId: user.id,
		actor: { userId: user.id, email: user.email, role: user.role },
	});

	return {
		user: { id: user.id, email: user.email, role: user.role, name },
		...tokens,
	};
};

const refreshSession = async (token: string) => {
	const verified = jwtUtils.verifyToken(token, config.jwt_refresh_secret);

	if (!verified.success || !verified.data) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or expired refresh token. Please log in again.",
		);
	}

	const payload = verified.data as JwtPayload & { userId: string };
	const tokenHash = sha256(token);

	const storedToken = await prisma.refreshToken.findUnique({
		where: { token: tokenHash },
	});
	if (!storedToken || storedToken.expiresAt < new Date()) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Refresh token has been revoked. Please log in again.",
		);
	}

	const user = await prisma.user.findFirst({
		where: { id: payload.userId, deletedAt: null },
	});
	if (!user || !user.isActive) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User is inactive or not found.",
		);
	}

	// Rotation: the presented refresh token is single-use. Deleting it before
	// issuing a new one means a stolen, already-used token can't be replayed.
	await prisma.refreshToken.delete({ where: { id: storedToken.id } });

	const name = await getProfileName(user.id, user.role);
	return issueAuthSession(user, name);
};

const logout = async (token?: string) => {
	if (!token) return;
	await prisma.refreshToken.deleteMany({ where: { token: sha256(token) } });
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let email: string | undefined;
	let sub: string | undefined;

	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});
		const ticketPayload = ticket.getPayload();
		email = ticketPayload?.email;
		sub = ticketPayload?.sub;
	} catch {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or expired Google ID token.",
		);
	}

	if (!email || !sub) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Google account has no verified email.",
		);
	}

	email = email.toLowerCase();
	const user = await prisma.user.findFirst({
		where: { email, deletedAt: null },
	});

	if (!user) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"No account found for this Google email. Please register first.",
		);
	}

	if (!user.isActive) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Your account has been deactivated. Please contact support.",
		);
	}

	if (user.googleId !== sub) {
		await prisma.user.update({
			where: { id: user.id },
			data: { googleId: sub },
		});
	}

	const name = await getProfileName(user.id, user.role);
	const tokens = await issueAuthSession(user, name);

	await recordAuditLog({
		action: "USER_GOOGLE_LOGIN",
		entityType: "User",
		entityId: user.id,
		actor: { userId: user.id, email: user.email, role: user.role },
	});

	return {
		user: { id: user.id, email: user.email, role: user.role, name },
		...tokens,
	};
};

export const AuthService = {
	register,
	login,
	refreshSession,
	logout,
	googleLogin,
};
