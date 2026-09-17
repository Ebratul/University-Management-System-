import type { Request, Response } from "express";
import httpStatus from "http-status";

import { getRequestUser } from "../../utils/getRequestUser";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DepartmentService } from "./department.service";

const createDepartment = catchAsync(async (req: Request, res: Response) => {
	const result = await DepartmentService.createDepartment(
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Department created successfully.",
		data: result,
	});
});

const getDepartments = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await DepartmentService.getDepartments(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Departments retrieved successfully.",
		data,
		meta,
	});
});

const getDepartmentById = catchAsync(async (req: Request, res: Response) => {
	const result = await DepartmentService.getDepartmentById(
		req.params.id as string,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department retrieved successfully.",
		data: result,
	});
});

const updateDepartment = catchAsync(async (req: Request, res: Response) => {
	const result = await DepartmentService.updateDepartment(
		req.params.id as string,
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department updated successfully.",
		data: result,
	});
});

const deleteDepartment = catchAsync(async (req: Request, res: Response) => {
	await DepartmentService.deleteDepartment(
		req.params.id as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department deleted successfully.",
		data: null,
	});
});

export const DepartmentController = {
	createDepartment,
	getDepartments,
	getDepartmentById,
	updateDepartment,
	deleteDepartment,
};
