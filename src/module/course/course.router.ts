import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CourseController } from "./course.controller";
import { CourseValidation } from "./course.validation";

const router = Router();

router.get("/", CourseController.getCourses);
router.get("/:id", CourseController.getCourseById);

router.post(
	"/",
	auth(Role.ADMIN),
	validateRequest(CourseValidation.CreateZodSchema),
	CourseController.createCourse,
);
router.patch(
	"/:id",
	auth(Role.ADMIN),
	validateRequest(CourseValidation.UpdateZodSchema),
	CourseController.updateCourse,
);
router.delete("/:id", auth(Role.ADMIN), CourseController.deleteCourse);

export const CourseRouter = router;
