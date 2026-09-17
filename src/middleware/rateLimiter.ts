import type { Response } from "express";
import { rateLimit } from "express-rate-limit";
import httpStatus from "http-status";

const jsonLimitHandler = (message: string) =>
	function handler(_req: unknown, res: Response) {
		res.status(httpStatus.TOO_MANY_REQUESTS).json({
			success: false,
			statusCode: httpStatus.TOO_MANY_REQUESTS,
			message,
			errors: undefined,
		});
	};

// Auth endpoints (login/register/refresh/google) are brute-force targets.
export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	standardHeaders: true,
	legacyHeaders: false,
	handler: jsonLimitHandler("Too many auth attempts. Please try again later."),
});

// The bKash callback is public and can be hit repeatedly while a payer completes checkout.
export const paymentCallbackLimiter = rateLimit({
	windowMs: 5 * 60 * 1000,
	limit: 60,
	standardHeaders: true,
	legacyHeaders: false,
	handler: jsonLimitHandler(
		"Too many payment callback requests. Please try again later.",
	),
});

// Baseline limiter for the whole API surface.
export const generalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 300,
	standardHeaders: true,
	legacyHeaders: false,
	handler: jsonLimitHandler("Too many requests. Please slow down."),
});

// Account-creation endpoints (admin/faculty/student signup) are a spam and
// enumeration target — tighter than generalLimiter but looser than
// authLimiter, since a busy admin genuinely may create several accounts
// in a session.
export const accountCreationLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 30,
	standardHeaders: true,
	legacyHeaders: false,
	handler: jsonLimitHandler(
		"Too many account-creation requests. Please try again later.",
	),
});
