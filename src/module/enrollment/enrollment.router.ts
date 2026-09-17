import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentValidation } from "./enrollment.validation";

const router = Router();

router.get(
	"/",
	auth(Role.ADMIN, Role.FACULTY, Role.STUDENT),
	EnrollmentController.listEnrollments,
);
router.get(
	"/:id",
	auth(Role.ADMIN, Role.FACULTY, Role.STUDENT),
	EnrollmentController.getEnrollmentById,
);
router.post(
	"/",
	auth(Role.STUDENT),
	validateRequest(EnrollmentValidation.CreateZodSchema),
	EnrollmentController.enroll,
);
router.patch(
	"/:id/status",
	auth(Role.ADMIN, Role.FACULTY),
	validateRequest(EnrollmentValidation.UpdateStatusZodSchema),
	EnrollmentController.updateStatus,
);

export const EnrollmentRouter = router;
