import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { ResultService } from "./result.service";

const publishResult = catchAsync(async (req: Request, res: Response) => {
	const result = await ResultService.publishResult(
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Result published successfully.",
		data: result,
	});
});

const listResults = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await ResultService.listResults(
		req.query,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Results retrieved successfully.",
		data,
		meta,
	});
});

const getResultById = catchAsync(async (req: Request, res: Response) => {
	const result = await ResultService.getResultById(
		req.params.id as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Result retrieved successfully.",
		data: result,
	});
});

const updateResult = catchAsync(async (req: Request, res: Response) => {
	const result = await ResultService.updateResult(
		req.params.id as string,
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Result updated successfully.",
		data: result,
	});
});

export const ResultController = {
	publishResult,
	listResults,
	getResultById,
	updateResult,
};
