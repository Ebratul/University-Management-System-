import { z } from "zod";

const CreateZodSchema = z.object({
	name: z.string().trim().min(2).max(150),
	code: z
		.string()
		.trim()
		.min(2)
		.max(20)
		.transform((value) => value.toUpperCase()),
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
});

export const DepartmentValidation = { CreateZodSchema, UpdateZodSchema };
