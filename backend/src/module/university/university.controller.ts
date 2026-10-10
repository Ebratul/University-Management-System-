import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { UniversityService } from "./university.service";

const createUniversity = catchAsync(async (req: Request, res: Response) => {
	const result = await UniversityService.createUniversity(
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "University created successfully.",
		data: result,
	});
});

const getUniversities = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await UniversityService.getUniversities(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Universities retrieved successfully.",
		data,
		meta,
	});
});

const getUniversityById = catchAsync(async (req: Request, res: Response) => {
	const result = await UniversityService.getUniversityById(
		req.params.id as string,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "University retrieved successfully.",
		data: result,
	});
});

const updateUniversity = catchAsync(async (req: Request, res: Response) => {
	const result = await UniversityService.updateUniversity(
		req.params.id as string,
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "University updated successfully.",
		data: result,
	});
});

export const UniversityController = {
	createUniversity,
	getUniversities,
	getUniversityById,
	updateUniversity,
};
