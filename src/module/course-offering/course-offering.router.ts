import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CourseOfferingController } from "./course-offering.controller";
import { CourseOfferingValidation } from "./course-offering.validation";

const router = Router();

router.get("/", CourseOfferingController.getOfferings);
router.get("/:id", CourseOfferingController.getOfferingById);

router.post(
	"/",
	auth(Role.ADMIN),
	validateRequest(CourseOfferingValidation.CreateZodSchema),
	CourseOfferingController.createOffering,
);
router.patch(
	"/:id",
	auth(Role.ADMIN),
	validateRequest(CourseOfferingValidation.UpdateZodSchema),
	CourseOfferingController.updateOffering,
);
router.post(
	"/:id/assign-faculty",
	auth(Role.ADMIN),
	validateRequest(CourseOfferingValidation.AssignFacultyZodSchema),
	CourseOfferingController.assignFaculty,
);
router.delete(
	"/:id",
	auth(Role.ADMIN),
	CourseOfferingController.deleteOffering,
);

export const CourseOfferingRouter = router;
