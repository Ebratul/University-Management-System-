import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminService } from "./admin.service";

const listAuditLogs = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await AdminService.listAuditLogs(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Audit logs retrieved successfully.",
		data,
		meta,
	});
});

export const AdminController = { listAuditLogs };
