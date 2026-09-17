import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import helmet from "helmet";
import httpStatus from "http-status";

import config from "./config";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { notFound } from "./middleware/notFound";
import { generalLimiter } from "./middleware/rateLimiter";
import { requestLogger } from "./middleware/requestLogger";
import { apiRouter } from "./routes";

const app: Application = express();

// Correct req.ip (used by rate limiting and audit-log IP capture) behind a
// reverse proxy/load balancer — without this every request looks like it
// comes from the proxy's own address in production.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
	cors({
		origin: (origin, callback) => {
			// Same-origin requests, curl, and server-to-server calls send no Origin header.
			if (!origin || config.cors_allowed_origins.includes(origin)) {
				return callback(null, true);
			}
			return callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
	}),
);
app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use(requestLogger);

app.get("/", (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		statusCode: httpStatus.OK,
		message: "Welcome to the University Management System Backend API!",
		data: { docs: "/api/v1/health" },
	});
});

app.use("/api/v1", generalLimiter, apiRouter);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
