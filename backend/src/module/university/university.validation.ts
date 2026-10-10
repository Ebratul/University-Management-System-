import { z } from "zod";

// A plain host name such as "student.sust.edu": no scheme, "@", path or spaces.
const DOMAIN_PATTERN =
	/^(?=.{4,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

const domain = z
	.string()
	.trim()
	.toLowerCase()
	.transform((value) => value.replace(/^@/, ""))
	.refine((value) => DOMAIN_PATTERN.test(value), {
		message: "Enter a domain like student.example.edu (no @ or spaces).",
	});

const name = z.string().trim().min(2).max(150);

const CreateZodSchema = z.object({
	name,
	studentDomain: domain,
	teacherDomain: domain,
	isActive: z.boolean().optional(),
});

const UpdateZodSchema = z
	.object({
		name: name.optional(),
		studentDomain: domain.optional(),
		teacherDomain: domain.optional(),
		isActive: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "Send at least one field to update.",
	});

export const UniversityValidation = { CreateZodSchema, UpdateZodSchema };
