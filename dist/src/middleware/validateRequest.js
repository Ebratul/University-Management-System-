import httpStatus from "http-status";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
export const validateRequest = (zodSchema) => {
    return catchAsync((req, res, next) => {
        // const payload = req.body ? req.body : {}
        const payload = req.body ?? {};
        const result = zodSchema.safeParse(payload);
        if (!result.success) {
            console.log(result.error);
            console.log(result.error.issues);
            throw new AppError(httpStatus.BAD_REQUEST, result.error.issues[0]?.message ?? "Invalid request");
        }
        req.body = result.data;
        next();
    });
};
//# sourceMappingURL=validateRequest.js.map