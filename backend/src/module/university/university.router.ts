import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UniversityController } from "./university.controller";
import { UniversityValidation } from "./university.validation";

const router = Router();

// Domain configuration decides who may sign in with Google, so every route,
// reads included, is admin-only. Universities are deactivated, never deleted.
router.use(auth(Role.ADMIN));

router.get("/", UniversityController.getUniversities);
router.get("/:id", UniversityController.getUniversityById);
router.post(
	"/",
	validateRequest(UniversityValidation.CreateZodSchema),
	UniversityController.createUniversity,
);
router.patch(
	"/:id",
	validateRequest(UniversityValidation.UpdateZodSchema),
	UniversityController.updateUniversity,
);

export const UniversityRouter = router;
