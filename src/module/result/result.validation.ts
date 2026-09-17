import { z } from "zod";

const CreateZodSchema = z.object({
	enrollmentId: z.uuid(),
	grade: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-F][+-]?$/, "Grade must look like A, A-, B+, etc."),
	gradePoint: z.number().min(0).max(5),
});

const UpdateZodSchema = z.object({
	grade: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-F][+-]?$/, "Grade must look like A, A-, B+, etc.")
		.optional(),
	gradePoint: z.number().min(0).max(5).optional(),
});

export const ResultValidation = { CreateZodSchema, UpdateZodSchema };
