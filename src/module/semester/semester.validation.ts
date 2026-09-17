import { SemesterStatus } from "@prisma/client";
import { z } from "zod";

const CreateZodSchema = z
	.object({
		year: z.number().int().min(2000).max(2100),
		code: z.string().trim().min(3).max(30),
		startDate: z.coerce.date(),
		endDate: z.coerce.date(),
		status: z.enum(SemesterStatus).optional(),
	})
	.refine((data) => data.endDate > data.startDate, {
		message: "endDate must be after startDate.",
		path: ["endDate"],
	});

const UpdateZodSchema = z.object({
	year: z.number().int().min(2000).max(2100).optional(),
	code: z.string().trim().min(3).max(30).optional(),
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	status: z.enum(SemesterStatus).optional(),
});

export const SemesterValidation = { CreateZodSchema, UpdateZodSchema };
