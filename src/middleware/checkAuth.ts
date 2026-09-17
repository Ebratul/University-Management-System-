import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { JwtPayload } from "jsonwebtoken";

import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

export interface RequestUser {
	email: string;
	name: string;
	userId: string;
	role: Role;
}

declare global {
	namespace Express {
		interface Request {
			user?: RequestUser;
		}
	}
}

const extractToken = (req: Request): string | undefined => {
	if (req.cookies?.accessToken) {
		return req.cookies.accessToken as string;
	}

	const header = req.headers.authorization;
	if (!header) return undefined;

	return header.startsWith("Bearer ") ? header.slice(7) : header;
};

// auth() with no roles just requires a valid, active session.
// auth(Role.ADMIN, Role.FACULTY) restricts to those roles.
export const auth = (...requiredRoles: Role[]) => {
	return catchAsync(
		async (req: Request, _res: Response, next: NextFunction) => {
			const token = extractToken(req);

			if (!token) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"You are not logged in. Please log in to access this resource.",
				);
			}

			const verifiedToken = jwtUtils.verifyToken(
				token,
				config.jwt_access_secret,
			);

			if (!verifiedToken.success || !verifiedToken.data) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Invalid or expired access token.",
				);
			}

			const { userId, name, role } = verifiedToken.data as JwtPayload & {
				userId: string;
				email: string;
				name: string;
				role: Role;
			};

			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					email: true,
					role: true,
					isActive: true,
					deletedAt: true,
				},
			});

			if (!user || user.deletedAt) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"User not found. Please log in again.",
				);
			}

			if (!user.isActive) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"Your account has been deactivated. Please contact support.",
				);
			}

			// The DB role is the source of truth: if an admin changed this user's role
			// since the token was issued, the old token must stop granting the old role.
			if (user.role !== role) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					"Your permissions have changed. Please log in again.",
				);
			}

			if (requiredRoles.length && !requiredRoles.includes(user.role)) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"You don't have permission to access this resource.",
				);
			}

			req.user = {
				userId: user.id,
				email: user.email,
				name,
				role: user.role,
			};

			next();
		},
	);
};
