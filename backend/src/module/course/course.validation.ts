import { CourseType } from "@prisma/client";
import { z } from "zod";

// Whole or half credits: 0.5, 1, 1.5, ... 10.
const credits = z
	.number()
	.min(0.5)
	.max(10)
	.refine((value) => Number.isInteger(value * 2), {
		message: "Credits must be a multiple of 0.5.",
	});

const CreateZodSchema = z.object({
	courseCode: z
		.string()
		.trim()
		.min(2)
		.max(20)
		.transform((value) => value.toUpperCase()),
	title: z.string().trim().min(2).max(150),
	credits,
	description: z.string().trim().max(2000).optional(),
	courseType: z.enum(CourseType).optional(),
	prerequisiteId: z.uuid().nullable().optional(),
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
	credits: credits.optional(),
	description: z.string().trim().max(2000).optional(),
	courseType: z.enum(CourseType).optional(),
	prerequisiteId: z.uuid().nullable().optional(),
	departmentId: z.uuid().optional(),
});

export const CourseValidation = { CreateZodSchema, UpdateZodSchema };
