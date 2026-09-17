import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import httpStatus from "http-status";
import { getBkashToken } from "./lib/bkash";
const app = express();
app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.get("/", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to University Management System Backend API!",
    });
});
app.get("/test", async (req, res, next) => {
    try {
        const grantIdTokenResult = await getBkashToken();
        console.log(grantIdTokenResult);
        res.status(httpStatus.OK).json({
            success: true,
            message: "Welcome to PH Healthcare System Backend",
            data: null,
        });
    }
    catch (error) {
        console.log(error);
        next(error);
    }
});
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API Not Found!",
        error: {
            path: req.originalUrl,
            message: "The requested path does not exist.",
        },
    });
});
export default app;
//# sourceMappingURL=app.js.map