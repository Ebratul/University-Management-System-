import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { RegistrationSettingService } from "./registration-setting.service";

const listSettings = catchAsync(async (_req: Request, res: Response) => {
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Registration settings retrieved successfully.",
		data: await RegistrationSettingService.listSettings(),
	});
});

const getSetting = catchAsync(async (req: Request, res: Response) => {
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Registration setting retrieved successfully.",
		data: await RegistrationSettingService.getSetting(
			req.params.semesterId as string,
		),
	});
});

const upsertSetting = catchAsync(async (req: Request, res: Response) => {
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Registration setting saved.",
		data: await RegistrationSettingService.upsertSetting(
			req.params.semesterId as string,
			req.body,
			getRequestUser(req),
		),
	});
});

export const RegistrationSettingController = {
	listSettings,
	getSetting,
	upsertSetting,
};
