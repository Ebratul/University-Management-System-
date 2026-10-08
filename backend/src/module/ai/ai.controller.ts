import type { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { getRequestUser } from "../../utils/getRequestUser";
import { sendResponse } from "../../utils/sendResponse";
import { AiService } from "./ai.service";

const generateQuiz = catchAsync(async (req: Request, res: Response) => {
	const result = await AiService.generateQuiz(req.body, getRequestUser(req));
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Questions generated. Review them before saving.",
		data: result,
	});
});

export const AiController = { generateQuiz };
