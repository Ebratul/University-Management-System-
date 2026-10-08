import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { aiGenerationLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { AiController } from "./ai.controller";
import { AiValidation } from "./ai.validation";

const router = Router();

// auth first, so the limiter and the AI call are never reachable anonymously.
router.post(
	"/quiz/generate",
	auth(Role.FACULTY, Role.ADMIN),
	aiGenerationLimiter,
	validateRequest(AiValidation.GenerateQuizZodSchema),
	AiController.generateQuiz,
);

export const AiRouter = router;
