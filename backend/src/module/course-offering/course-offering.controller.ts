import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { CourseOfferingService } from "./course-offering.service";

const createOffering = catchAsync(async (req: Request, res: Response) => {
	const result = await CourseOfferingService.createOffering(
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Course offering created successfully.",
		data: result,
	});
});

const getOfferings = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await CourseOfferingService.getOfferings(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Course offerings retrieved successfully.",
		data,
		meta,
	});
});

const getOfferingById = catchAsync(async (req: Request, res: Response) => {
	const result = await CourseOfferingService.getOfferingById(
		req.params.id as string,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Course offering retrieved successfully.",
		data: result,
	});
});

const updateOffering = catchAsync(async (req: Request, res: Response) => {
	const result = await CourseOfferingService.updateOffering(
		req.params.id as string,
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Course offering updated successfully.",
		data: result,
	});
});

const assignFaculty = catchAsync(async (req: Request, res: Response) => {
	const result = await CourseOfferingService.assignFaculty(
		req.params.id as string,
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Faculty assigned successfully.",
		data: result,
	});
});

const deleteOffering = catchAsync(async (req: Request, res: Response) => {
	await CourseOfferingService.deleteOffering(
		req.params.id as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Course offering deleted successfully.",
		data: null,
	});
});

export const CourseOfferingController = {
	createOffering,
	getOfferings,
	getOfferingById,
	updateOffering,
	assignFaculty,
	deleteOffering,
};
