import { Router } from "express";

import { authLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
	"/register",
	authLimiter,
	validateRequest(AuthValidation.RegisterZodSchema),
	AuthController.register,
);
router.post(
	"/login",
	authLimiter,
	validateRequest(AuthValidation.LoginZodSchema),
	AuthController.login,
);
router.post(
	"/refresh-token",
	authLimiter,
	validateRequest(AuthValidation.RefreshTokenZodSchema),
	AuthController.refreshToken,
);
router.post(
	"/logout",
	validateRequest(AuthValidation.LogoutZodSchema),
	AuthController.logout,
);
router.post(
	"/google",
	authLimiter,
	validateRequest(AuthValidation.GoogleLoginZodSchema),
	AuthController.googleLogin,
);

export const AuthRouter = router;
