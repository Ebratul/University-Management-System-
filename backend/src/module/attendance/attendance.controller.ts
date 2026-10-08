import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { AttendanceService } from "./attendance.service";

const offeringId = (req: Request) => req.params.offeringId as string;

const getRoster = catchAsync(async (req: Request, res: Response) => {
	const result = await AttendanceService.getRoster(
		offeringId(req),
		getRequestUser(req),
		req.query.date as string | undefined,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Attendance roster retrieved successfully.",
		data: result,
	});
});

const markAttendance = catchAsync(async (req: Request, res: Response) => {
	const result = await AttendanceService.markAttendance(
		offeringId(req),
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Attendance saved successfully.",
		data: result,
	});
});

const getSummary = catchAsync(async (req: Request, res: Response) => {
	const result = await AttendanceService.getSummary(
		offeringId(req),
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Attendance summary retrieved successfully.",
		data: result,
	});
});

const getMyAttendance = catchAsync(async (req: Request, res: Response) => {
	const result = await AttendanceService.getMyAttendance(
		offeringId(req),
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Your attendance retrieved successfully.",
		data: result,
	});
});

const getStudentAttendance = catchAsync(async (req: Request, res: Response) => {
	const result = await AttendanceService.getStudentAttendance(
		offeringId(req),
		req.params.studentId as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Student attendance retrieved successfully.",
		data: result,
	});
});

export const AttendanceController = {
	getRoster,
	markAttendance,
	getSummary,
	getMyAttendance,
	getStudentAttendance,
};
