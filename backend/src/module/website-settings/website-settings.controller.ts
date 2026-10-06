import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { WebsiteSettingsService } from "./website-settings.service";

const getSettings = catchAsync(async (_req: Request, res: Response) => {
	const result = await WebsiteSettingsService.getSettings();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Website settings retrieved successfully.",
		data: result,
	});
});

const updateSettings = catchAsync(async (req: Request, res: Response) => {
	const result = await WebsiteSettingsService.updateSettings(
		req.body,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Website settings updated successfully.",
		data: result,
	});
});

const uploadLogo = catchAsync(async (req: Request, res: Response) => {
	const result = await WebsiteSettingsService.replaceAsset(
		"logo",
		req.file,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "University logo updated successfully.",
		data: result,
	});
});

const deleteLogo = catchAsync(async (req: Request, res: Response) => {
	const result = await WebsiteSettingsService.removeAsset(
		"logo",
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "University logo removed.",
		data: result,
	});
});

const uploadBackground = catchAsync(async (req: Request, res: Response) => {
	const result = await WebsiteSettingsService.replaceAsset(
		"background",
		req.file,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Homepage background updated successfully.",
		data: result,
	});
});

const deleteBackground = catchAsync(async (req: Request, res: Response) => {
	const result = await WebsiteSettingsService.removeAsset(
		"background",
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Homepage background removed.",
		data: result,
	});
});

export const WebsiteSettingsController = {
	getSettings,
	updateSettings,
	uploadLogo,
	deleteLogo,
	uploadBackground,
	deleteBackground,
};
