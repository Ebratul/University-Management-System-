import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { RegistrationSettingController } from "./registration-setting.controller";
import { RegistrationSettingValidation } from "./registration-setting.validation";

const router = Router();

// Fees, limits and windows are university policy: admin only.
router.get("/", auth(Role.ADMIN), RegistrationSettingController.listSettings);
router.get(
	"/:semesterId",
	auth(Role.ADMIN),
	RegistrationSettingController.getSetting,
);
router.put(
	"/:semesterId",
	auth(Role.ADMIN),
	validateRequest(RegistrationSettingValidation.UpsertZodSchema),
	RegistrationSettingController.upsertSetting,
);

export const RegistrationSettingRouter = router;
