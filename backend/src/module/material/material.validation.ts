import { z } from "zod";

const UploadZodSchema = z.object({
	title: z.string().trim().min(1).max(150).optional(),
});

export const MaterialValidation = { UploadZodSchema };
