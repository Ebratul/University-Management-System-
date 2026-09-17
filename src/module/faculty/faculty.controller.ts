import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { FacultyService } from "./faculty.service";

const createFaculty = catchAsync(async (req: Request, res: Response) => {
	const result = await FacultyService.createFaculty(
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Faculty created successfully.",
		data: result,
	});
});

const getFaculties = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await FacultyService.getFaculties(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Faculties retrieved successfully.",
		data,
		meta,
	});
});

const getFacultyById = catchAsync(async (req: Request, res: Response) => {
	const result = await FacultyService.getFacultyById(req.params.id as string);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Faculty retrieved successfully.",
		data: result,
	});
});

const updateFaculty = catchAsync(async (req: Request, res: Response) => {
	const result = await FacultyService.updateFaculty(
		req.params.id as string,
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Faculty updated successfully.",
		data: result,
	});
});

const deleteFaculty = catchAsync(async (req: Request, res: Response) => {
	await FacultyService.deleteFaculty(
		req.params.id as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Faculty deleted successfully.",
		data: null,
	});
});

export const FacultyController = {
	createFaculty,
	getFaculties,
	getFacultyById,
	updateFaculty,
	deleteFaculty,
};
