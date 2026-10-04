import type { Request, Response } from "express";
import httpStatus from "http-status";

import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { UserServices } from "./user.service";

const getMe = catchAsync(async (req: Request, res: Response) => {
	const requester = getRequestUser(req);
	const result = await UserServices.getMe(requester.userId);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile retrieved successfully.",
		data: result,
	});
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
	const requester = getRequestUser(req);
	const result = await UserServices.updateMe(
		requester.userId,
		requester.role,
		req.body,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile updated successfully.",
		data: result,
	});
});

const listUsers = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await UserServices.listUsers(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users retrieved successfully.",
		data,
		meta,
	});
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
	const result = await UserServices.getUserById(req.params.id as string);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User retrieved successfully.",
		data: result,
	});
});

const changeRole = catchAsync(async (req: Request, res: Response) => {
	const requester = getRequestUser(req);
	const result = await UserServices.changeRole(
		req.params.id as string,
		req.body.role,
		requester,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User role updated successfully.",
		data: result,
	});
});

const changeStatus = catchAsync(async (req: Request, res: Response) => {
	const requester = getRequestUser(req);
	const result = await UserServices.changeStatus(
		req.params.id as string,
		req.body.isActive,
		requester,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `User ${req.body.isActive ? "activated" : "deactivated"} successfully.`,
		data: result,
	});
});

const softDeleteUser = catchAsync(async (req: Request, res: Response) => {
	const requester = getRequestUser(req);
	await UserServices.softDeleteUser(req.params.id as string, requester);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User deleted successfully.",
		data: null,
	});
});

const createAdmin = catchAsync(async (req: Request, res: Response) => {
	const requester = getRequestUser(req);
	const result = await UserServices.createAdmin(req.body, requester);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Admin account created successfully.",
		data: result,
	});
});

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
	if (!req.file) {
		throw new AppError(httpStatus.BAD_REQUEST, "No file provided.");
	}

	const requester = getRequestUser(req);
	const result = await UserServices.uploadProfileImage(
		req.file.buffer,
		requester.userId,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile image uploaded successfully.",
		data: result,
	});
});

export const UserController = {
	getMe,
	updateMe,
	listUsers,
	getUserById,
	changeRole,
	changeStatus,
	softDeleteUser,
	createAdmin,
	uploadProfileImage,
};
