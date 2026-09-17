import { NoticeAudience } from "@prisma/client";
import { z } from "zod";

const CreateZodSchema = z.object({
	title: z.string().trim().min(3).max(200),
	content: z.string().trim().min(1).max(5000),
	audience: z.enum(NoticeAudience).optional(),
});

const UpdateZodSchema = z.object({
	title: z.string().trim().min(3).max(200).optional(),
	content: z.string().trim().min(1).max(5000).optional(),
	audience: z.enum(NoticeAudience).optional(),
});

export const NoticeValidation = { CreateZodSchema, UpdateZodSchema };
