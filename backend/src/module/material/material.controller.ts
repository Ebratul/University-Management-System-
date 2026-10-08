import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { MaterialService } from "./material.service";

const listMaterials = catchAsync(async (req: Request, res: Response) => {
	const result = await MaterialService.listMaterials(
		req.params.offeringId as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Materials retrieved successfully.",
		data: result,
	});
});

const uploadMaterial = catchAsync(async (req: Request, res: Response) => {
	const result = await MaterialService.uploadMaterial(
		req.params.offeringId as string,
		req.body,
		req.file,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Material uploaded successfully.",
		data: result,
	});
});

const getAccessUrl = catchAsync(async (req: Request, res: Response) => {
	const result = await MaterialService.getAccessUrl(
		req.params.offeringId as string,
		req.params.materialId as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Material link generated.",
		data: result,
	});
});

const deleteMaterial = catchAsync(async (req: Request, res: Response) => {
	await MaterialService.deleteMaterial(
		req.params.offeringId as string,
		req.params.materialId as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Material deleted successfully.",
		data: null,
	});
});

export const MaterialController = {
	listMaterials,
	uploadMaterial,
	getAccessUrl,
	deleteMaterial,
};
