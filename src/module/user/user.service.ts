import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";

import config from "../../config";
import type { IActor } from "../../interface";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { USER_SORTABLE_FIELDS } from "./user.constant";
import type {
	ICreateAdminPayload,
	IUpdateMePayload,
	IUserListQuery,
} from "./user.interface";

const PROFILE_SELECT = {
	admin: { select: { id: true, name: true, phone: true } },
	faculty: {
		select: {
			id: true,
			facultyId: true,
			name: true,
			phone: true,
			designation: true,
			departmentId: true,
		},
	},
	student: {
		select: {
			id: true,
			studentId: true,
			name: true,
			phone: true,
			dateOfBirth: true,
			departmentId: true,
			admissionSemesterId: true,
		},
	},
} satisfies Prisma.UserInclude;

const getMe = async (userId: string) => {
	const user = await prisma.user.findFirst({
		where: { id: userId, deletedAt: null },
		include: PROFILE_SELECT,
		omit: { password: true },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	return user;
};

const updateMe = async (
	userId: string,
	role: Role,
	payload: IUpdateMePayload,
) => {
	const data = {
		name: payload.name,
		phone: payload.phone,
		...(role === Role.STUDENT ? { dateOfBirth: payload.dateOfBirth } : {}),
	};

	if (role === Role.ADMIN) {
		await prisma.admin.update({ where: { userId }, data });
	} else if (role === Role.FACULTY) {
		await prisma.faculty.update({ where: { userId }, data });
	} else {
		await prisma.student.update({ where: { userId }, data });
	}

	return getMe(userId);
};

const listUsers = async (query: IUserListQuery) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		USER_SORTABLE_FIELDS,
	);

	const andConditions: Prisma.UserWhereInput[] = [{ deletedAt: null }];

	if (query.role) {
		andConditions.push({ role: query.role as Role });
	}

	if (query.searchTerm) {
		const contains = query.searchTerm;
		andConditions.push({
			OR: [
				{ email: { contains, mode: "insensitive" } },
				{ admin: { name: { contains, mode: "insensitive" } } },
				{ faculty: { name: { contains, mode: "insensitive" } } },
				{ student: { name: { contains, mode: "insensitive" } } },
			],
		});
	}

	const where: Prisma.UserWhereInput = { AND: andConditions };

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			include: PROFILE_SELECT,
			omit: { password: true },
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.user.count({ where }),
	]);

	return { data: users, meta: buildMeta(total, page, limit) };
};

const getUserById = async (id: string) => {
	const user = await prisma.user.findFirst({
		where: { id, deletedAt: null },
		include: PROFILE_SELECT,
		omit: { password: true },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	return user;
};

const changeRole = async (id: string, nextRole: Role, actor: IActor) => {
	const user = await prisma.user.findFirst({
		where: { id, deletedAt: null },
		include: PROFILE_SELECT,
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	if (user.role === nextRole) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`User already has the ${nextRole} role.`,
		);
	}

	// Changing role only flips which profile is active for this user — it never
	// fabricates a new profile. Create the target profile first via
	// POST /faculties, POST /students, or POST /users (admin) if it doesn't exist yet.
	const hasTargetProfile =
		(nextRole === Role.ADMIN && user.admin) ||
		(nextRole === Role.FACULTY && user.faculty) ||
		(nextRole === Role.STUDENT && user.student);

	if (!hasTargetProfile) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`This user has no ${nextRole.toLowerCase()} profile yet. Create one for them first.`,
		);
	}

	const updated = await prisma.user.update({
		where: { id },
		data: { role: nextRole },
		omit: { password: true },
	});

	await recordAuditLog({
		action: "USER_ROLE_CHANGED",
		entityType: "User",
		entityId: id,
		description: `Role changed from ${user.role} to ${nextRole}`,
		actor,
	});

	return updated;
};

const changeStatus = async (id: string, isActive: boolean, actor: IActor) => {
	const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	const updated = await prisma.user.update({
		where: { id },
		data: { isActive },
		omit: { password: true },
	});

	await recordAuditLog({
		action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
		entityType: "User",
		entityId: id,
		actor,
	});

	return updated;
};

const softDeleteUser = async (id: string, actor: IActor) => {
	const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	const now = new Date();

	await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		await tx.user.update({
			where: { id },
			data: { deletedAt: now, isActive: false },
		});
		await tx.admin.updateMany({
			where: { userId: id },
			data: { deletedAt: now },
		});
		await tx.faculty.updateMany({
			where: { userId: id },
			data: { deletedAt: now },
		});
		await tx.student.updateMany({
			where: { userId: id },
			data: { deletedAt: now },
		});
	});

	await recordAuditLog({
		action: "USER_DELETED",
		entityType: "User",
		entityId: id,
		actor,
	});
};

const createAdmin = async (payload: ICreateAdminPayload, actor: IActor) => {
	const email = payload.email.trim().toLowerCase();

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			"An account with this email already exists.",
		);
	}

	const hashedPassword = await bcrypt.hash(
		payload.password,
		Number(config.bcrypt_salt_rounds),
	);

	const user = await prisma.user.create({
		data: {
			email,
			password: hashedPassword,
			role: Role.ADMIN,
			admin: { create: { name: payload.name, phone: payload.phone } },
		},
		include: { admin: true },
		omit: { password: true },
	});

	await recordAuditLog({
		action: "ADMIN_CREATED",
		entityType: "User",
		entityId: user.id,
		description: `Admin account created for ${email}`,
		actor,
	});

	return user;
};

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
	const currentUser = await prisma.user.findUnique({
		where: { id: userId },
		select: { imagePublicId: true, imageUrl: true },
	});

	const cloudinaryResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream({ resource_type: "auto" }, (error, result) => {
					if (error) return reject(error);
					if (!result)
						return reject(new Error("No result returned from Cloudinary"));
					resolve(result);
				})
				.end(buffer);
		},
	);

	const updatedUser = await prisma.user.update({
		where: { id: userId },
		data: {
			imageUrl: cloudinaryResult.secure_url,
			imagePublicId: cloudinaryResult.public_id,
		},
		omit: { password: true },
	});

	if (currentUser?.imagePublicId && currentUser.imageUrl) {
		await cloudinary.uploader.destroy(currentUser.imagePublicId);
	}

	return updatedUser;
};

export const UserServices = {
	getMe,
	updateMe,
	listUsers,
	getUserById,
	changeRole,
	changeStatus,
	softDeleteUser,
	createAdmin,
	uploadProfileImage,
};
