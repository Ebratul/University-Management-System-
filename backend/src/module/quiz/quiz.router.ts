import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { QuizController } from "./quiz.controller";
import { QuizValidation } from "./quiz.validation";

// Ownership / enrollment is checked in the service for every route; the role
// guards here only keep the wrong kind of user out early.
const staff = auth(Role.FACULTY, Role.ADMIN);
const student = auth(Role.STUDENT);

// Mounted at /course-offerings/:offeringId/quizzes
const offeringRouter = Router({ mergeParams: true });
offeringRouter.get("/", auth(), QuizController.listQuizzes);
offeringRouter.post(
	"/",
	staff,
	validateRequest(QuizValidation.CreateZodSchema),
	QuizController.createQuiz,
);

// Mounted at /quizzes
const router = Router();
router.get("/:quizId", auth(), QuizController.getQuiz);
router.patch(
	"/:quizId",
	staff,
	validateRequest(QuizValidation.UpdateZodSchema),
	QuizController.updateQuiz,
);
router.delete("/:quizId", staff, QuizController.deleteQuiz);
router.put(
	"/:quizId/questions",
	staff,
	validateRequest(QuizValidation.ReplaceQuestionsZodSchema),
	QuizController.replaceQuestions,
);
router.post("/:quizId/publish", staff, QuizController.publishQuiz);
router.post("/:quizId/unpublish", staff, QuizController.unpublishQuiz);
router.post("/:quizId/start", staff, QuizController.startQuiz);
router.get(
	"/:quizId/results",
	staff,
	validateRequest(QuizValidation.ResultsQuerySchema, "query"),
	QuizController.getResults,
);

router.post("/:quizId/attempt", student, QuizController.beginAttempt);
router.put(
	"/:quizId/attempt/answers",
	student,
	validateRequest(QuizValidation.SaveAnswersZodSchema),
	QuizController.saveAnswers,
);
router.post(
	"/:quizId/submit",
	student,
	validateRequest(QuizValidation.SubmitZodSchema),
	QuizController.submitAttempt,
);
router.get("/:quizId/my-result", student, QuizController.getMyResult);

export const QuizOfferingRouter = offeringRouter;
export const QuizRouter = router;
