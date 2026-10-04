import { Role } from "@prisma/client";
import { z } from "zod";

const UpdateMeZodSchema = z.object({
	name: z.string().trim().min(3).max(100).optional(),
	phone: z.string().trim().min(6).max(20).optional(),
	dateOfBirth: z.coerce.date().optional(),
});

const ChangeRoleZodSchema = z.object({
	role: z.enum(Role),
});

const ChangeStatusZodSchema = z.object({
	isActive: z.boolean(),
});

const CreateAdminZodSchema = z.object({
	name: z.string().trim().min(3).max(100),
	email: z.email(),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters long.")
		.regex(/[a-z]/, "Password must contain at least 1 lowercase letter.")
		.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter.")
		.regex(/[0-9]/, "Password must contain at least 1 number.")
		.regex(
			/[^A-Za-z0-9]/,
			"Password must contain at least 1 special character.",
		),
	phone: z.string().trim().min(6).max(20).optional(),
});

export const UserValidation = {
	UpdateMeZodSchema,
	ChangeRoleZodSchema,
	ChangeStatusZodSchema,
	CreateAdminZodSchema,
};
