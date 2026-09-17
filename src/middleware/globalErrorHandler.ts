import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { ZodError } from "zod";

import config from "../config";
import { AppError, type TErrorDetail } from "../utils/AppError";

export const globalErrorHandler = (
	err: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction,
) => {
	if (config.node_env === "development") {
		console.error("Error from Global Error Handler:", err);
	}

	let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
	let message = "Something went wrong";
	let errors: TErrorDetail[] | undefined;

	if (err instanceof AppError) {
		statusCode = err.statusCode;
		message = err.message;
		errors = err.errors;
	} else if (err instanceof ZodError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Validation failed";
		errors = err.issues.map((issue) => ({
			path: issue.path.join(".") || "body",
			message: issue.message,
		}));
	} else if (err instanceof Prisma.PrismaClientValidationError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Invalid or missing fields in the request";
	} else if (err instanceof Prisma.PrismaClientKnownRequestError) {
		if (err.code === "P2002") {
			statusCode = httpStatus.CONFLICT;
			const target = (err.meta?.target as string[] | undefined)?.join(", ");
			message = target
				? `A record with this ${target} already exists`
				: "Duplicate value violates a unique constraint";
		} else if (err.code === "P2003") {
			statusCode = httpStatus.BAD_REQUEST;
			message = "This action references a record that does not exist";
		} else if (err.code === "P2025") {
			statusCode = httpStatus.NOT_FOUND;
			message = "The requested record was not found";
		} else {
			statusCode = httpStatus.BAD_REQUEST;
			message = "Database request failed";
		}
	} else if (err instanceof Prisma.PrismaClientInitializationError) {
		statusCode = httpStatus.SERVICE_UNAVAILABLE;
		message = "Could not connect to the database";
	} else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
		statusCode = httpStatus.INTERNAL_SERVER_ERROR;
		message = "An unexpected database error occurred";
	} else if (err instanceof TokenExpiredError) {
		statusCode = httpStatus.UNAUTHORIZED;
		message = "Token has expired. Please log in again.";
	} else if (err instanceof JsonWebTokenError) {
		statusCode = httpStatus.UNAUTHORIZED;
		message = "Invalid token. Please log in again.";
	} else if (err instanceof Error) {
		message = config.node_env === "development" ? err.message : message;
	}

	res.status(statusCode).json({
		success: false,
		statusCode,
		message,
		errors,
		stack:
			config.node_env === "development" && err instanceof Error
				? err.stack
				: undefined,
	});
};
