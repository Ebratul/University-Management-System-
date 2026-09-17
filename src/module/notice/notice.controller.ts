import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { NoticeService } from "./notice.service";

const createNotice = catchAsync(async (req: Request, res: Response) => {
	const result = await NoticeService.createNotice(
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Notice created successfully.",
		data: result,
	});
});

const getNotices = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await NoticeService.getNotices(
		req.query,
		req.user?.role,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notices retrieved successfully.",
		data,
		meta,
	});
});

const getNoticeById = catchAsync(async (req: Request, res: Response) => {
	const result = await NoticeService.getNoticeById(
		req.params.id as string,
		req.user?.role,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notice retrieved successfully.",
		data: result,
	});
});

const updateNotice = catchAsync(async (req: Request, res: Response) => {
	const result = await NoticeService.updateNotice(
		req.params.id as string,
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notice updated successfully.",
		data: result,
	});
});

const deleteNotice = catchAsync(async (req: Request, res: Response) => {
	await NoticeService.deleteNotice(
		req.params.id as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notice deleted successfully.",
		data: null,
	});
});

export const NoticeController = {
	createNotice,
	getNotices,
	getNoticeById,
	updateNotice,
	deleteNotice,
};
