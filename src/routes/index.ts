import { Router } from "express";
import httpStatus from "http-status";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/health", async (_req, res) => {
	try {
		await prisma.$queryRaw`SELECT 1`;
		res.status(httpStatus.OK).json({
			success: true,
			statusCode: httpStatus.OK,
			message: "API is healthy",
			data: { database: "up", timestamp: new Date().toISOString() },
		});
	} catch {
		res.status(httpStatus.SERVICE_UNAVAILABLE).json({
			success: false,
			statusCode: httpStatus.SERVICE_UNAVAILABLE,
			message: "Database is unreachable",
			errors: undefined,
		});
	}
});

// Feature module routers are mounted here as they land, one per phase of the build.

export const apiRouter = router;
