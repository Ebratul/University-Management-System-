import { Role } from "@prisma/client";
import { Router } from "express";

import upload from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { accountCreationLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

const router = Router();

router.get("/me", auth(), UserController.getMe);
router.patch(
	"/me",
	auth(),
	validateRequest(UserValidation.UpdateMeZodSchema),
	UserController.updateMe,
);
router.patch(
	"/profile-image",
	auth(),
	upload.single("profileImage"),
	UserController.uploadProfileImage,
);

router.get("/", auth(Role.ADMIN), UserController.listUsers);
router.post(
	"/",
	auth(Role.ADMIN),
	accountCreationLimiter,
	validateRequest(UserValidation.CreateAdminZodSchema),
	UserController.createAdmin,
);

router.get("/:id", auth(Role.ADMIN), UserController.getUserById);
router.patch(
	"/:id/role",
	auth(Role.ADMIN),
	validateRequest(UserValidation.ChangeRoleZodSchema),
	UserController.changeRole,
);
router.patch(
	"/:id/status",
	auth(Role.ADMIN),
	validateRequest(UserValidation.ChangeStatusZodSchema),
	UserController.changeStatus,
);
router.delete("/:id", auth(Role.ADMIN), UserController.softDeleteUser);

export const UserRoutes = router;
