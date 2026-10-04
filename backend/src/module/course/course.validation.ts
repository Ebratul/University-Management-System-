import { z } from "zod";

const CreateZodSchema = z.object({
	courseCode: z
		.string()
		.trim()
		.min(2)
		.max(20)
		.transform((value) => value.toUpperCase()),
	title: z.string().trim().min(2).max(150),
	credits: z.number().int().min(1).max(10),
	departmentId: z.uuid(),
});

const UpdateZodSchema = z.object({
	courseCode: z
		.string()
		.trim()
		.min(2)
		.max(20)
		.transform((value) => value.toUpperCase())
		.optional(),
	title: z.string().trim().min(2).max(150).optional(),
	credits: z.number().int().min(1).max(10).optional(),
	departmentId: z.uuid().optional(),
});

export const CourseValidation = { CreateZodSchema, UpdateZodSchema };
