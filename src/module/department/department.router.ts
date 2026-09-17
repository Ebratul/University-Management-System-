import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { DepartmentController } from "./department.controller";
import { DepartmentValidation } from "./department.validation";

const router = Router();

// Department listing is public: a registration form or course catalog page
// needs it before the visitor has an account.
router.get("/", DepartmentController.getDepartments);
router.get("/:id", DepartmentController.getDepartmentById);

router.post(
	"/",
	auth(Role.ADMIN),
	validateRequest(DepartmentValidation.CreateZodSchema),
	DepartmentController.createDepartment,
);
router.patch(
	"/:id",
	auth(Role.ADMIN),
	validateRequest(DepartmentValidation.UpdateZodSchema),
	DepartmentController.updateDepartment,
);
router.delete("/:id", auth(Role.ADMIN), DepartmentController.deleteDepartment);

export const DepartmentRouter = router;
