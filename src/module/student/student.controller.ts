import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { StudentService } from "./student.service";

const createStudent = catchAsync(async (req: Request, res: Response) => {
	const result = await StudentService.createStudent(
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Student created successfully.",
		data: result,
	});
});

const getStudents = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await StudentService.getStudents(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Students retrieved successfully.",
		data,
		meta,
	});
});

const getStudentById = catchAsync(async (req: Request, res: Response) => {
	const result = await StudentService.getStudentById(
		req.params.id as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Student retrieved successfully.",
		data: result,
	});
});

const updateStudent = catchAsync(async (req: Request, res: Response) => {
	const result = await StudentService.updateStudent(
		req.params.id as string,
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Student updated successfully.",
		data: result,
	});
});

const deleteStudent = catchAsync(async (req: Request, res: Response) => {
	await StudentService.deleteStudent(
		req.params.id as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Student deleted successfully.",
		data: null,
	});
});

export const StudentController = {
	createStudent,
	getStudents,
	getStudentById,
	updateStudent,
	deleteStudent,
};
