import { Role } from "@prisma/client";
import { Router } from "express";
import httpStatus from "http-status";
import multer from "multer";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AppError } from "../../utils/AppError";
import { MaterialController } from "./material.controller";
import { MaterialValidation } from "./material.validation";

const pdfUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 10 * 1024 * 1024, files: 1 },
	fileFilter: (_req, file, callback) => {
		if (file.mimetype !== "application/pdf") {
			return callback(
				new AppError(httpStatus.BAD_REQUEST, "Only PDF files are allowed."),
			);
		}
		callback(null, true);
	},
});

// Mounted at /course-offerings/:offeringId/materials
const router = Router({ mergeParams: true });

// Membership is checked inside the service (teacher / enrolled student / admin).
router.get("/", auth(), MaterialController.listMaterials);
router.get("/:materialId/url", auth(), MaterialController.getAccessUrl);

router.post(
	"/",
	auth(Role.FACULTY, Role.ADMIN),
	pdfUpload.single("file"),
	validateRequest(MaterialValidation.UploadZodSchema),
	MaterialController.uploadMaterial,
);
router.delete(
	"/:materialId",
	auth(Role.FACULTY, Role.ADMIN),
	MaterialController.deleteMaterial,
);

export const MaterialRouter = router;
