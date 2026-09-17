import { z } from "zod";

const InitiateZodSchema = z.object({
	semesterId: z.uuid(),
});

const CallbackZodSchema = z.object({
	paymentID: z.string().min(1, "paymentID is required."),
	status: z.string().min(1, "status is required."),
});

export const PaymentValidation = { InitiateZodSchema, CallbackZodSchema };
