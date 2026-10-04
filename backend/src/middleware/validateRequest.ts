import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type z from "zod";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

type TValidationTarget = "body" | "query" | "params";

export const validateRequest = (
	zodSchema: z.ZodObject,
	target: TValidationTarget = "body",
) => {
	return catchAsync((req: Request, _res: Response, next: NextFunction) => {
		const source = req as unknown as Record<
			TValidationTarget,
			Record<string, unknown>
		>;
		const payload = source[target] ?? {};

		const result = zodSchema.safeParse(payload);

		if (!result.success) {
			const errors = result.error.issues.map((issue) => ({
				path: issue.path.join(".") || target,
				message: issue.message,
			}));

			throw new AppError(httpStatus.BAD_REQUEST, "Validation failed", errors);
		}

		// A request without a body (for example a POST from a client that sends
		// no payload) leaves req.body undefined. Replace it outright instead of
		// trying to mutate it.
		if (target === "body") {
			req.body = result.data;
			return next();
		}

		// req.query has no setter in Express 5 (it's a computed getter), so we
		// mutate the existing object in place instead of reassigning it. This
		// also drops any field the schema didn't recognize/pass through.
		const existing = source[target];
		for (const key of Object.keys(existing)) {
			delete existing[key];
		}
		Object.assign(existing, result.data);

		next();
	});
};
