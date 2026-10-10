import { randomUUID } from "node:crypto";

import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { sendCodeEmail } from "../../utils/authEmails";
import { destroyQuietly, uploadBuffer } from "../../utils/cloudinaryUpload";
import { consumeCode, issueCode } from "../../utils/emailCode";
import { generateSequenceId } from "../../utils/generateId";
import { sha256 } from "../../utils/hash";
import { jwtUtils } from "../../utils/jwt";
import type {
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginPayload,
	IRegisterPayload,
	IResetPasswordPayload,
	IVerifyEmailPayload,
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
		// A random id makes every refresh token unique. Without it, two sessions
		// issued for the same user within one second were byte-identical and the
		// second one hit the unique index on stored tokens (a 409 on login).
		{ ...jwtPayload, jti: randomUUID() },
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

const PICTURE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

// With no semester chosen, admit into the ongoing semester, else the next
// upcoming one, else the most recent.
const findDefaultAdmissionSemester = async () => {
	const live = { deletedAt: null };
	return (
		(await prisma.semester.findFirst({
			where: { ...live, status: "ONGOING" },
			orderBy: { startDate: "desc" },
		})) ??
		(await prisma.semester.findFirst({
			where: { ...live, status: "UPCOMING" },
			orderBy: { startDate: "asc" },
		})) ??
		prisma.semester.findFirst({ where: live, orderBy: { startDate: "desc" } })
	);
};

const register = async (
	payload: IRegisterPayload,
	picture: Express.Multer.File | undefined,
) => {
	if (!picture) {
		throw new AppError(httpStatus.BAD_REQUEST, "Student picture is required.");
	}
	if (!PICTURE_MIME_TYPES.includes(picture.mimetype)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Student picture must be a JPG, PNG or WebP image.",
		);
	}

	const email = payload.email.trim().toLowerCase();

	const existingUser = await prisma.user.findFirst({
		where: { email, deletedAt: null },
	});
	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"An account with this email already exists.",
		);
	}

	const existingRegistration = await prisma.student.findFirst({
		where: { registrationNumber: payload.registrationNumber, deletedAt: null },
		select: { id: true },
	});
	if (existingRegistration) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This registration number is already registered.",
		);
	}

	const [department, semester] = await Promise.all([
		prisma.department.findFirst({
			where: { id: payload.departmentId, deletedAt: null },
		}),
		payload.admissionSemesterId
			? prisma.semester.findFirst({
					where: { id: payload.admissionSemesterId, deletedAt: null },
				})
			: findDefaultAdmissionSemester(),
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

	let uploaded: UploadApiResponse;
	try {
		uploaded = await uploadBuffer(picture.buffer, {
			resource_type: "image",
			folder: "ums/students",
		});
	} catch (error) {
		console.error("Cloudinary upload failed for student picture:", error);
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"The picture could not be uploaded. Please try again.",
		);
	}

	const createUser = () =>
		prisma.user.create({
			data: {
				email,
				password: hashedPassword,
				role: Role.STUDENT,
				// Cannot log in until the emailed code is entered.
				emailVerified: false,
				imageUrl: uploaded.secure_url,
				imagePublicId: uploaded.public_id,
				student: {
					create: {
						studentId,
						registrationNumber: payload.registrationNumber,
						name: payload.name,
						phone: payload.phone,
						dateOfBirth: payload.dateOfBirth,
						departmentId: department.id,
						admissionSemesterId: semester.id,
						currentSemesterLevel: payload.semesterLevel ?? 1,
					},
				},
			},
			include: { student: true },
		});

	// Self-registration always creates a STUDENT account. Admin/Faculty accounts
	// are provisioned by an admin via the /faculties and /users endpoints.
	let user: Awaited<ReturnType<typeof createUser>>;
	try {
		user = await createUser();
	} catch (error) {
		await destroyQuietly(uploaded.public_id); // don't orphan the new picture
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			// Lost a race with another sign-up for the same email/registration number.
			throw new AppError(
				httpStatus.CONFLICT,
				"An account with this email or registration number already exists.",
			);
		}
		throw error;
	}

	await recordAuditLog({
		action: "USER_REGISTER",
		entityType: "User",
		entityId: user.id,
		description: `Student self-registered (email not yet verified): ${email}`,
		actor: { userId: user.id, email: user.email, role: user.role },
	});

	// No session yet: the student proves they own the address first. A failed
	// send does not undo the registration; the verify screen has "Resend code".
	const emailSent = await sendCode(
		user.id,
		email,
		payload.name,
		"VERIFY_EMAIL",
	);

	return {
		user: {
			id: user.id,
			email: user.email,
			role: user.role,
			student: user.student,
		},
		verificationRequired: true,
		emailSent,
	};
};

// Issues a code and emails it. Returns false when nothing was sent (cooldown
// or a mail failure); never throws, so callers can answer without revealing why.
const sendCode = async (
	userId: string,
	email: string,
	name: string,
	purpose: "VERIFY_EMAIL" | "RESET_PASSWORD",
): Promise<boolean> => {
	try {
		const code = await issueCode(userId, purpose);
		if (!code) return false;
		await sendCodeEmail(email, name, purpose, code);
		return true;
	} catch (error) {
		console.error(`Could not send ${purpose} email to ${email}:`, error);
		return false;
	}
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

	// Checked only after the password is right, so this never reveals whether
	// someone else's address is registered. The marker lets the UI offer the
	// verification screen.
	if (!user.emailVerified) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Please verify your email address before logging in.",
			[{ path: "email", message: "EMAIL_NOT_VERIFIED" }],
		);
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
	if (!user?.isActive) {
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

// One answer for every "this Google account may not sign in" case, so the
// response does not reveal whether an address, domain or account exists.
const GOOGLE_DENIED = "This Google account is not authorized to sign in.";

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let email: string | undefined;
	let sub: string | undefined;
	let emailVerified = false;

	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});
		const ticketPayload = ticket.getPayload();
		email = ticketPayload?.email;
		sub = ticketPayload?.sub;
		emailVerified = ticketPayload?.email_verified === true;
	} catch {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or expired Google ID token.",
		);
	}

	if (!email || !sub || !emailVerified) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Google account has no verified email.",
		);
	}

	email = email.toLowerCase();
	const domain = email.slice(email.lastIndexOf("@") + 1);

	// The domain must belong to an active university; it also tells us which
	// role this address is expected to have.
	const university = await prisma.university.findFirst({
		where: {
			isActive: true,
			OR: [{ studentDomain: domain }, { teacherDomain: domain }],
		},
	});
	if (!university) throw new AppError(httpStatus.FORBIDDEN, GOOGLE_DENIED);
	const expectedRole =
		university.studentDomain === domain ? Role.STUDENT : Role.FACULTY;

	// A matching domain is never enough: the user must already exist, be active,
	// hold exactly the expected role, and belong to this university.
	const user = await prisma.user.findFirst({
		where: { email, deletedAt: null },
		include: {
			student: { select: { department: { select: { universityId: true } } } },
			faculty: { select: { department: { select: { universityId: true } } } },
		},
	});
	const affiliation =
		expectedRole === Role.STUDENT
			? user?.student?.department.universityId
			: user?.faculty?.department.universityId;

	if (
		!user ||
		!user.isActive ||
		user.role !== expectedRole ||
		affiliation !== university.id
	) {
		throw new AppError(httpStatus.FORBIDDEN, GOOGLE_DENIED);
	}

	// An account already linked to one Google identity cannot be taken over by another.
	if (user.googleId && user.googleId !== sub) {
		throw new AppError(httpStatus.FORBIDDEN, GOOGLE_DENIED);
	}

	if (user.googleId !== sub || !user.emailVerified) {
		// Google has verified this address, so a pending sign-up is now confirmed.
		await prisma.user.update({
			where: { id: user.id },
			data: { googleId: sub, emailVerified: true },
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

const findLiveUserByEmail = (rawEmail: string) =>
	prisma.user.findFirst({
		where: { email: rawEmail.trim().toLowerCase(), deletedAt: null },
	});

const never = (): never => {
	throw new AppError(
		httpStatus.BAD_REQUEST,
		"That code is invalid or has expired. Request a new one.",
	);
};

// Entering the code proves the address, completes sign-up, and signs in.
// Every failure gets the same answer, so nothing here confirms an account exists.
const verifyEmail = async (payload: IVerifyEmailPayload) => {
	const user = await findLiveUserByEmail(payload.email);
	if (!user?.isActive || user.emailVerified) return never();
	await consumeCode(user.id, "VERIFY_EMAIL", payload.code);

	const verified = await prisma.user.update({
		where: { id: user.id },
		data: { emailVerified: true },
	});
	const name = await getProfileName(verified.id, verified.role);
	const tokens = await issueAuthSession(verified, name);

	await recordAuditLog({
		action: "USER_EMAIL_VERIFIED",
		entityType: "User",
		entityId: verified.id,
		actor: { userId: verified.id, email: verified.email, role: verified.role },
	});

	return {
		user: { id: verified.id, email: verified.email, role: verified.role, name },
		...tokens,
	};
};

// Always the same answer, whether or not the address has an account.
const resendVerification = async (payload: IForgotPasswordPayload) => {
	const user = await findLiveUserByEmail(payload.email);
	if (user?.isActive && !user.emailVerified) {
		const name = await getProfileName(user.id, user.role);
		await sendCode(user.id, user.email, name, "VERIFY_EMAIL");
	}
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const user = await findLiveUserByEmail(payload.email);
	if (user?.isActive) {
		const name = await getProfileName(user.id, user.role);
		await sendCode(user.id, user.email, name, "RESET_PASSWORD");
	}
};

const resetPassword = async (payload: IResetPasswordPayload) => {
	const user = await findLiveUserByEmail(payload.email);
	if (!user?.isActive) return never();
	await consumeCode(user.id, "RESET_PASSWORD", payload.code);

	const hashedPassword = await bcrypt.hash(
		payload.newPassword,
		Number(config.bcrypt_salt_rounds),
	);
	await prisma.$transaction([
		// Receiving the code also proves the address, so a stuck unverified
		// sign-up can be recovered this way too.
		prisma.user.update({
			where: { id: user.id },
			data: { password: hashedPassword, emailVerified: true },
		}),
		// Everyone signed in with the old password is signed out.
		prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
	]);

	await recordAuditLog({
		action: "USER_PASSWORD_RESET",
		entityType: "User",
		entityId: user.id,
		actor: { userId: user.id, email: user.email, role: user.role },
	});
};

export const AuthService = {
	register,
	login,
	refreshSession,
	logout,
	googleLogin,
	verifyEmail,
	resendVerification,
	forgotPassword,
	resetPassword,
};
