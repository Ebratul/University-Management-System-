import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { FacultyController } from "./faculty.controller";
import { FacultyValidation } from "./faculty.validation";

const router = Router();

// Faculty directory is public.
router.get("/", FacultyController.getFaculties);
router.get("/:id", FacultyController.getFacultyById);

router.post(
	"/",
	auth(Role.ADMIN),
	validateRequest(FacultyValidation.CreateZodSchema),
	FacultyController.createFaculty,
);
router.patch(
	"/:id",
	auth(Role.ADMIN),
	validateRequest(FacultyValidation.UpdateZodSchema),
	FacultyController.updateFaculty,
);
router.delete("/:id", auth(Role.ADMIN), FacultyController.deleteFaculty);

export const FacultyRouter = router;
