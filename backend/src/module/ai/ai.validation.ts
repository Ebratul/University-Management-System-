import { z } from "zod";

import { MAX_AI_QUESTIONS } from "./ai.constant";

const GenerateQuizZodSchema = z.object({
	offeringId: z.uuid("Invalid course id."),
	materialId: z.uuid("Invalid material id."),
	numberOfQuestions: z.number().int().min(1).max(MAX_AI_QUESTIONS).default(10),
	difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

export const AiValidation = { GenerateQuizZodSchema };
