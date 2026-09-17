import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SemesterController } from "./semester.controller";
import { SemesterValidation } from "./semester.validation";

const router = Router();

router.get("/", SemesterController.getSemesters);
router.get("/:id", SemesterController.getSemesterById);

router.post(
	"/",
	auth(Role.ADMIN),
	validateRequest(SemesterValidation.CreateZodSchema),
	SemesterController.createSemester,
);
router.patch(
	"/:id",
	auth(Role.ADMIN),
	validateRequest(SemesterValidation.UpdateZodSchema),
	SemesterController.updateSemester,
);
router.delete("/:id", auth(Role.ADMIN), SemesterController.deleteSemester);

export const SemesterRouter = router;
