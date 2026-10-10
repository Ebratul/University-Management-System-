import { z } from "zod";

const CreateZodSchema = z.object({
	name: z.string().trim().min(2).max(150),
	code: z
		.string()
		.trim()
		.min(2)
		.max(20)
		.transform((value) => value.toUpperCase()),
	universityId: z.uuid().nullable().optional(),
});

const UpdateZodSchema = z.object({
	name: z.string().trim().min(2).max(150).optional(),
	code: z
		.string()
		.trim()
		.min(2)
		.max(20)
		.transform((value) => value.toUpperCase())
		.optional(),
	universityId: z.uuid().nullable().optional(),
});

export const DepartmentValidation = { CreateZodSchema, UpdateZodSchema };
