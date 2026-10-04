import { z } from "zod";

const CreateZodSchema = z.object({
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
	designation: z.string().trim().min(2).max(100).optional(),
	departmentId: z.uuid(),
});

const UpdateZodSchema = z.object({
	name: z.string().trim().min(3).max(100).optional(),
	phone: z.string().trim().min(6).max(20).optional(),
	designation: z.string().trim().min(2).max(100).optional(),
	departmentId: z.uuid().optional(),
});

export const FacultyValidation = { CreateZodSchema, UpdateZodSchema };
