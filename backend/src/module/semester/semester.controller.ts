import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { SemesterService } from "./semester.service";

const createSemester = catchAsync(async (req: Request, res: Response) => {
	const result = await SemesterService.createSemester(
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Semester created successfully.",
		data: result,
	});
});

const getSemesters = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await SemesterService.getSemesters(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Semesters retrieved successfully.",
		data,
		meta,
	});
});

const getSemesterById = catchAsync(async (req: Request, res: Response) => {
	const result = await SemesterService.getSemesterById(req.params.id as string);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Semester retrieved successfully.",
		data: result,
	});
});

const updateSemester = catchAsync(async (req: Request, res: Response) => {
	const result = await SemesterService.updateSemester(
		req.params.id as string,
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Semester updated successfully.",
		data: result,
	});
});

const deleteSemester = catchAsync(async (req: Request, res: Response) => {
	await SemesterService.deleteSemester(
		req.params.id as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Semester deleted successfully.",
		data: null,
	});
});

export const SemesterController = {
	createSemester,
	getSemesters,
	getSemesterById,
	updateSemester,
	deleteSemester,
};
