import { z } from "zod";

const UpdateZodSchema = z
	.object({
		universityName: z.string().trim().min(2).max(120).optional(),
		tagline: z.string().trim().min(2).max(240).optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "Provide at least one field to update.",
	});

export const WebsiteSettingsValidation = { UpdateZodSchema };
