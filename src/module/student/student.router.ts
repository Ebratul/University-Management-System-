import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { StudentController } from "./student.controller";
import { StudentValidation } from "./student.validation";

const router = Router();

// Student records are PII: no public read. List is admin-only bulk data;
// getById also allows Faculty (grading context) and the student themselves.
router.get("/", auth(Role.ADMIN), StudentController.getStudents);
router.get(
	"/:id",
	auth(Role.ADMIN, Role.FACULTY, Role.STUDENT),
	StudentController.getStudentById,
);

router.post(
	"/",
	auth(Role.ADMIN),
	validateRequest(StudentValidation.CreateZodSchema),
	StudentController.createStudent,
);
router.patch(
	"/:id",
	auth(Role.ADMIN),
	validateRequest(StudentValidation.UpdateZodSchema),
	StudentController.updateStudent,
);
router.delete("/:id", auth(Role.ADMIN), StudentController.deleteStudent);

export const StudentRouter = router;
