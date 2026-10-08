import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { RegistrationController } from "./registration.controller";
import { RegistrationValidation } from "./registration.validation";

const router = Router();

// Literal paths first: "/:id" would otherwise swallow "available", "preview", "stats".
router.get(
	"/available",
	auth(Role.STUDENT),
	validateRequest(RegistrationValidation.AvailableQuerySchema, "query"),
	RegistrationController.getAvailable,
);
router.post(
	"/preview",
	auth(Role.STUDENT),
	validateRequest(RegistrationValidation.SelectionZodSchema),
	RegistrationController.preview,
);
router.get(
	"/stats",
	auth(Role.ADMIN),
	validateRequest(RegistrationValidation.AdminListQuerySchema, "query"),
	RegistrationController.stats,
);

router.post(
	"/",
	auth(Role.STUDENT),
	validateRequest(RegistrationValidation.SelectionZodSchema),
	RegistrationController.submit,
);
router.get(
	"/",
	auth(Role.STUDENT, Role.ADMIN),
	validateRequest(RegistrationValidation.AdminListQuerySchema, "query"),
	RegistrationController.list,
);

// Ownership (a student only ever reaches their own) is enforced in the service.
router.get(
	"/:id",
	auth(Role.STUDENT, Role.ADMIN),
	RegistrationController.getOne,
);
router.post("/:id/pay", auth(Role.STUDENT), RegistrationController.pay);
router.post(
	"/:id/refresh-payment",
	auth(Role.STUDENT, Role.ADMIN),
	RegistrationController.refreshPayment,
);
router.post(
	"/:id/cancel",
	auth(Role.STUDENT, Role.ADMIN),
	validateRequest(RegistrationValidation.CancelZodSchema),
	RegistrationController.cancel,
);
router.get(
	"/:id/receipt",
	auth(Role.STUDENT, Role.ADMIN),
	RegistrationController.receipt,
);
router.get(
	"/:id/receipt.pdf",
	auth(Role.STUDENT, Role.ADMIN),
	RegistrationController.receiptPdf,
);

export const RegistrationRouter = router;
