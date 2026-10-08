import type { Request, Response } from "express";
import httpStatus from "http-status";

import { AppError } from "../../utils/AppError";
import { clearAuthCookies, setAuthCookies } from "../../utils/authCookies";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthService } from "./auth.service";

const readToken = (
	req: Request,
	cookieName: "refreshToken",
): string | undefined => req.cookies?.[cookieName] ?? req.body?.refreshToken;

const register = catchAsync(async (req: Request, res: Response) => {
	// No auth cookies here: the account is unverified until the emailed code is entered.
	const result = await AuthService.register(req.body, req.file);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: result.emailSent
			? "Account created. We emailed you a verification code."
			: "Account created, but the verification email could not be sent. Use “Resend code”.",
		data: result,
	});
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.verifyEmail(req.body);
	setAuthCookies(res, result);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Email verified. You are now signed in.",
		data: result,
	});
});

const GENERIC_CODE_SENT =
	"If an account exists for that email, we have sent a code to it.";

const resendVerification = catchAsync(async (req: Request, res: Response) => {
	await AuthService.resendVerification(req.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: GENERIC_CODE_SENT,
		data: null,
	});
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
	await AuthService.forgotPassword(req.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: GENERIC_CODE_SENT,
		data: null,
	});
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
	await AuthService.resetPassword(req.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Password updated. Please log in with your new password.",
		data: null,
	});
});

const login = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.login(req.body);
	setAuthCookies(res, result);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged in successfully.",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	const token = readToken(req, "refreshToken");
	if (!token) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is required.");
	}

	const result = await AuthService.refreshSession(token);
	setAuthCookies(res, result);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "New tokens generated successfully.",
		data: result,
	});
});

const logout = catchAsync(async (req: Request, res: Response) => {
	const token = readToken(req, "refreshToken");
	await AuthService.logout(token);
	clearAuthCookies(res);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged out successfully.",
		data: null,
	});
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.googleLogin(req.body);
	setAuthCookies(res, result);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged in with Google successfully.",
		data: result,
	});
});

export const AuthController = {
	register,
	verifyEmail,
	resendVerification,
	forgotPassword,
	resetPassword,
	login,
	refreshToken,
	logout,
	googleLogin,
};
