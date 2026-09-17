import { z } from "zod";

const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters long.")
	.regex(/[a-z]/, "Password must contain at least 1 lowercase letter.")
	.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter.")
	.regex(/[0-9]/, "Password must contain at least 1 number.")
	.regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special character.");

const RegisterZodSchema = z.object({
	name: z
		.string()
		.trim()
		.min(3, "Name must be at least 3 characters long.")
		.max(100),
	email: z.email("Invalid email address."),
	password: passwordSchema,
	phone: z.string().trim().min(6).max(20).optional(),
	dateOfBirth: z.coerce.date().optional(),
	departmentId: z.uuid("Invalid department id."),
	admissionSemesterId: z.uuid("Invalid semester id."),
});

const LoginZodSchema = z.object({
	email: z.email("Invalid email address."),
	password: z.string().min(1, "Password is required."),
});

const RefreshTokenZodSchema = z.object({
	refreshToken: z.string().min(1).optional(),
});

const LogoutZodSchema = z.object({
	refreshToken: z.string().min(1).optional(),
});

const GoogleLoginZodSchema = z.object({
	idToken: z.string().min(10, "A valid Google idToken is required."),
});

export const AuthValidation = {
	RegisterZodSchema,
	LoginZodSchema,
	RefreshTokenZodSchema,
	LogoutZodSchema,
	GoogleLoginZodSchema,
};
