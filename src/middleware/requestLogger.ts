import type { NextFunction, Request, Response } from "express";

export const requestLogger = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const start = process.hrtime.bigint();

	res.on("finish", () => {
		const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
		console.log(
			`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`,
		);
	});

	next();
};
