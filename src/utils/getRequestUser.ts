import type { Request } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../middleware/checkAuth";
import { AppError } from "./AppError";

// Only ever call this behind the `auth()` middleware, which guarantees req.user is set.
export const getRequestUser = (req: Request): RequestUser => {
	if (!req.user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "You are not logged in.");
	}
	return req.user;
};
