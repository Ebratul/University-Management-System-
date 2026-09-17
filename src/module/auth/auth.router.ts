import { Role } from "@prisma/client";
import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { UserValidation } from "./auth.validataion";
import { auth } from "../../middleware/checkAuth";

const router = Router();

router.post(
	"/register",
	validateRequest(UserValidation.PatientRegistrationZodSchema),
);
router.post("/verify-email", validateRequest(UserValidation.LoginZodSchema));
router.post(
	"/verify-email",
	validateRequest(UserValidation.PatientEmailVerifyZodSchema),
);
router.post("/login", validateRequest(UserValidation.LoginZodSchema));
router.get("/me", auth(Role.ADMIN, Role.FACULTY, Role.STUDENT));
router.post("/refresh-token");
router.post("/google");
router.post(
	"/forgot-password",
	validateRequest(UserValidation.ForgotPasswordZodSchema),
);
router.post(
	"/reset-password",
	validateRequest(UserValidation.ResetPasswordZodSchema),
);
export const AuthRoutes = router;

export const AuthRouter = router;
