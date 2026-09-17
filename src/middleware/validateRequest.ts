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
		const source = req as unknown as Record<TValidationTarget, unknown>;
		const payload = source[target] ?? {};

		const result = zodSchema.safeParse(payload);

		if (!result.success) {
			const errors = result.error.issues.map((issue) => ({
				path: issue.path.join(".") || target,
				message: issue.message,
			}));

			throw new AppError(httpStatus.BAD_REQUEST, "Validation failed", errors);
		}

		source[target] = result.data;

		next();
	});
};
