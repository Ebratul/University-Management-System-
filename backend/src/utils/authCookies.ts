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

	// Path "/" (not "/api/v1/auth") so the browser also sends it with page
	// navigations. The frontend proxy reads it there to rotate an expired access
	// token before a protected page renders. The cookie stays httpOnly, and
	// Secure in production, so scripts still cannot read it.
	res.cookie("refreshToken", tokens.refreshToken, {
		httpOnly: true,
		secure: isProd,
		sameSite: "lax",
		path: "/",
	});
};

export const clearAuthCookies = (res: Response): void => {
	res.clearCookie("accessToken", { path: "/" });
	res.clearCookie("refreshToken", { path: "/" });
	// Sessions issued before the path change still hold the old-scoped cookie.
	res.clearCookie("refreshToken", { path: "/api/v1/auth" });
};
