import type { NextFunction, Request, Response } from "express";
import type z from "zod";
export declare const validateRequest: (zodSchema: z.ZodObject) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=validateRequest.d.ts.map