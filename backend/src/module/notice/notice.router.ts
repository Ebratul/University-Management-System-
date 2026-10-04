import { Role } from "@prisma/client";
import { Router } from "express";

import { auth, optionalAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { NoticeController } from "./notice.controller";
import { NoticeValidation } from "./notice.validation";

const router = Router();

// Public, but audience-filtered when the caller happens to be logged in.
router.get("/", optionalAuth, NoticeController.getNotices);
router.get("/:id", optionalAuth, NoticeController.getNoticeById);

router.post(
	"/",
	auth(Role.ADMIN),
	validateRequest(NoticeValidation.CreateZodSchema),
	NoticeController.createNotice,
);
router.patch(
	"/:id",
	auth(Role.ADMIN),
	validateRequest(NoticeValidation.UpdateZodSchema),
	NoticeController.updateNotice,
);
router.delete("/:id", auth(Role.ADMIN), NoticeController.deleteNotice);

export const NoticeRouter = router;
