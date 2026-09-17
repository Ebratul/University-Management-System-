import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { CourseService } from "./course.service";

const createCourse = catchAsync(async (req: Request, res: Response) => {
	const result = await CourseService.createCourse(
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Course created successfully.",
		data: result,
	});
});

const getCourses = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await CourseService.getCourses(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Courses retrieved successfully.",
		data,
		meta,
	});
});

const getCourseById = catchAsync(async (req: Request, res: Response) => {
	const result = await CourseService.getCourseById(req.params.id as string);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Course retrieved successfully.",
		data: result,
	});
});

const updateCourse = catchAsync(async (req: Request, res: Response) => {
	const result = await CourseService.updateCourse(
		req.params.id as string,
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Course updated successfully.",
		data: result,
	});
});

const deleteCourse = catchAsync(async (req: Request, res: Response) => {
	await CourseService.deleteCourse(
		req.params.id as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Course deleted successfully.",
		data: null,
	});
});

export const CourseController = {
	createCourse,
	getCourses,
	getCourseById,
	updateCourse,
	deleteCourse,
};
