import { Role } from "@prisma/client";
import { Router } from "express";
import httpStatus from "http-status";
import multer from "multer";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AppError } from "../../utils/AppError";
import { WebsiteSettingsController } from "./website-settings.controller";
import { WebsiteSettingsValidation } from "./website-settings.validation";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Branding images only: stricter than the shared profile-image uploader
// (JPG/PNG/WebP, no SVG, which can carry scripts).
const brandingUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024, files: 1 },
	fileFilter: (_req, file, callback) => {
		if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
			return callback(
				new AppError(
					httpStatus.BAD_REQUEST,
					"Only JPG, PNG or WebP images are allowed.",
				),
			);
		}
		callback(null, true);
	},
});

const router = Router();

// Public: the landing page and splash screen read this without logging in.
router.get("/", WebsiteSettingsController.getSettings);

router.patch(
	"/",
	auth(Role.ADMIN),
	validateRequest(WebsiteSettingsValidation.UpdateZodSchema),
	WebsiteSettingsController.updateSettings,
);

router.post(
	"/logo",
	auth(Role.ADMIN),
	brandingUpload.single("logo"),
	WebsiteSettingsController.uploadLogo,
);
router.delete("/logo", auth(Role.ADMIN), WebsiteSettingsController.deleteLogo);

router.post(
	"/background",
	auth(Role.ADMIN),
	brandingUpload.single("background"),
	WebsiteSettingsController.uploadBackground,
);
router.delete(
	"/background",
	auth(Role.ADMIN),
	WebsiteSettingsController.deleteBackground,
);

export const WebsiteSettingsRouter = router;
