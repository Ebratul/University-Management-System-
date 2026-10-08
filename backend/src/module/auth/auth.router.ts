import { Router } from "express";

import upload from "../../lib/multer";
import { authLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
	"/register",
	authLimiter,
	// multipart/form-data: text fields + a required "picture" image.
	upload.single("picture"),
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

router.post(
	"/verify-email",
	authLimiter,
	validateRequest(AuthValidation.VerifyEmailZodSchema),
	AuthController.verifyEmail,
);
router.post(
	"/resend-verification",
	authLimiter,
	validateRequest(AuthValidation.EmailOnlyZodSchema),
	AuthController.resendVerification,
);
router.post(
	"/forgot-password",
	authLimiter,
	validateRequest(AuthValidation.EmailOnlyZodSchema),
	AuthController.forgotPassword,
);
router.post(
	"/reset-password",
	authLimiter,
	validateRequest(AuthValidation.ResetPasswordZodSchema),
	AuthController.resetPassword,
);

export const AuthRouter = router;
