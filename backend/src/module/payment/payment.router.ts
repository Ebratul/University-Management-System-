import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { paymentCallbackLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

// Literal paths must be registered before the "/:id" catch-all, otherwise
// "/callback" and "/initiate" match as :id and hit the wrong handler.
router.post(
	"/initiate",
	auth(Role.STUDENT),
	validateRequest(PaymentValidation.InitiateZodSchema),
	PaymentController.initiatePayment,
);

// Public: bKash redirects the payer's browser here after checkout.
router.get(
	"/callback",
	paymentCallbackLimiter,
	validateRequest(PaymentValidation.CallbackZodSchema, "query"),
	PaymentController.handleCallback,
);

router.get("/", auth(Role.ADMIN, Role.STUDENT), PaymentController.listPayments);
router.get(
	"/:id",
	auth(Role.ADMIN, Role.STUDENT),
	PaymentController.getPaymentById,
);

export const PaymentRouter = router;
