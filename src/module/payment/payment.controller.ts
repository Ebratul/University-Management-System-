import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
	const requester = getRequestUser(req);
	const result = await PaymentService.initiatePayment(
		requester.userId,
		req.body,
		requester,
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message:
			"Payment initiated. Redirect the payer to bkashURL to complete checkout.",
		data: result,
	});
});

const handleCallback = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.handleCallback(req.query, req.ip);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `Payment ${result?.status.toLowerCase()}.`,
		data: result,
	});
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.getPaymentById(
		req.params.id as string,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment retrieved successfully.",
		data: result,
	});
});

const listPayments = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await PaymentService.listPayments(
		req.query,
		getRequestUser(req),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payments retrieved successfully.",
		data,
		meta,
	});
});

export const PaymentController = {
	initiatePayment,
	handleCallback,
	getPaymentById,
	listPayments,
};
