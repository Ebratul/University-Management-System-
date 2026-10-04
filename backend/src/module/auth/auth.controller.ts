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
	const result = await AuthService.register(req.body);
	setAuthCookies(res, result);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Registered successfully.",
		data: result,
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
	login,
	refreshToken,
	logout,
	googleLogin,
};
