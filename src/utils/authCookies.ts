import type { Response } from "express";
import config from "../config";

const isProd = config.node_env === "production";

export type TAuthTokens = {
	accessToken: string;
	refreshToken: string;
};

export const setAuthCookies = (res: Response, tokens: TAuthTokens): void => {
	res.cookie("accessToken", tokens.accessToken, {
		httpOnly: true,
		secure: isProd,
		sameSite: "lax",
		path: "/",
	});

	// Scoped to /api/v1/auth: only the refresh/logout endpoints need to read it.
	res.cookie("refreshToken", tokens.refreshToken, {
		httpOnly: true,
		secure: isProd,
		sameSite: "lax",
		path: "/api/v1/auth",
	});
};

export const clearAuthCookies = (res: Response): void => {
	res.clearCookie("accessToken", { path: "/" });
	res.clearCookie("refreshToken", { path: "/api/v1/auth" });
};
