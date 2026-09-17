import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ResultController } from "./result.controller";
import { ResultValidation } from "./result.validation";

const router = Router();

router.get(
	"/",
	auth(Role.ADMIN, Role.FACULTY, Role.STUDENT),
	ResultController.listResults,
);
router.get(
	"/:id",
	auth(Role.ADMIN, Role.FACULTY, Role.STUDENT),
	ResultController.getResultById,
);
router.post(
	"/",
	auth(Role.ADMIN, Role.FACULTY),
	validateRequest(ResultValidation.CreateZodSchema),
	ResultController.publishResult,
);
router.patch(
	"/:id",
	auth(Role.ADMIN, Role.FACULTY),
	validateRequest(ResultValidation.UpdateZodSchema),
	ResultController.updateResult,
);

export const ResultRouter = router;
