import { Role } from "@prisma/client";
import { Router } from "express";
import upload from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { UserController } from "./user.controller";

const router = Router();

router.patch(
	"/profile-image",
	auth(Role.ADMIN, Role.STUDENT, Role.FACULTY),
	upload.single("profileImage"),
	UserController.uploadProfileImage,
);

export const UserRoutes = router;
