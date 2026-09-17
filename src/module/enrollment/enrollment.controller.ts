import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { EnrollmentService } from "./enrollment.service";

const enroll = catchAsync(async (req: Request, res: Response) => {
	const requester = getRequestUser(req);
	const result = await EnrollmentService.enroll(
		requester.userId,
		req.body,
		requester,
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Enrolled successfully.",
		data: result,
	});
});

const listEnrollments = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await EnrollmentService.listEnrollments(
		req.query,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Enrollments retrieved successfully.",
		data,
		meta,
	});
});

const getEnrollmentById = catchAsync(async (req: Request, res: Response) => {
	const result = await EnrollmentService.getEnrollmentById(
		req.params.id as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Enrollment retrieved successfully.",
		data: result,
	});
});

const updateStatus = catchAsync(async (req: Request, res: Response) => {
	const result = await EnrollmentService.updateStatus(
		req.params.id as string,
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Enrollment status updated successfully.",
		data: result,
	});
});

export const EnrollmentController = {
	enroll,
	listEnrollments,
	getEnrollmentById,
	updateStatus,
};
