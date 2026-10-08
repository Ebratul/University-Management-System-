import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { RegistrationAdminService } from "./registration.admin.service";
import { getReceiptData, writeReceiptPdf } from "./registration.receipt";
import { RegistrationService } from "./registration.service";

const id = (req: Request) => req.params.id as string;

const respond = (
	res: Response,
	message: string,
	data: unknown,
	statusCode: number = httpStatus.OK,
	meta?: { page: number; limit: number; total: number; totalPages: number },
) => sendResponse(res, { statusCode, success: true, message, data, meta });

const getAvailable = catchAsync(async (req, res) =>
	respond(
		res,
		"Available courses retrieved successfully.",
		await RegistrationService.getAvailable(
			getRequestUser(req).userId,
			req.query.semesterId as string | undefined,
		),
	),
);

const preview = catchAsync(async (req, res) =>
	respond(
		res,
		"Registration checked.",
		await RegistrationService.preview(getRequestUser(req).userId, req.body),
	),
);

const submit = catchAsync(async (req, res) => {
	const user = getRequestUser(req);
	respond(
		res,
		"Registration submitted. Your invoice is ready.",
		await RegistrationService.submit(user.userId, req.body, user),
		httpStatus.CREATED,
	);
});

// Students see their own registrations; admins can filter across everyone.
const list = catchAsync(async (req, res) => {
	const user = getRequestUser(req);
	if (user.role === "ADMIN") {
		const { data, meta } = await RegistrationAdminService.listRegistrations(
			req.query,
		);
		return respond(
			res,
			"Registrations retrieved successfully.",
			data,
			httpStatus.OK,
			meta,
		);
	}
	const { data, meta } = await RegistrationService.listMine(
		user.userId,
		req.query,
	);
	respond(
		res,
		"Registrations retrieved successfully.",
		data,
		httpStatus.OK,
		meta,
	);
});

const stats = catchAsync(async (req, res) =>
	respond(
		res,
		"Registration statistics retrieved successfully.",
		await RegistrationAdminService.getStats(req.query),
	),
);

const getOne = catchAsync(async (req, res) =>
	respond(
		res,
		"Registration retrieved successfully.",
		await RegistrationService.getRegistration(id(req), getRequestUser(req)),
	),
);

const pay = catchAsync(async (req, res) =>
	respond(
		res,
		"Payment started. Redirect the student to bkashURL to complete it.",
		await RegistrationService.startPayment(id(req), getRequestUser(req)),
		httpStatus.CREATED,
	),
);

const refreshPayment = catchAsync(async (req, res) =>
	respond(
		res,
		"Payment status refreshed.",
		await RegistrationService.refreshPayment(id(req), getRequestUser(req)),
	),
);

const cancel = catchAsync(async (req, res) =>
	respond(
		res,
		"Registration closed.",
		await RegistrationService.cancel(id(req), req.body, getRequestUser(req)),
	),
);

const receipt = catchAsync(async (req, res) =>
	respond(
		res,
		"Receipt retrieved successfully.",
		await getReceiptData(id(req), getRequestUser(req)),
	),
);

const receiptPdf = catchAsync(async (req: Request, res: Response) => {
	writeReceiptPdf(await getReceiptData(id(req), getRequestUser(req)), res);
});

export const RegistrationController = {
	getAvailable,
	preview,
	submit,
	list,
	stats,
	getOne,
	pay,
	refreshPayment,
	cancel,
	receipt,
	receiptPdf,
};
