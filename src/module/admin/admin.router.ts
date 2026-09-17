import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { AdminController } from "./admin.controller";

const router = Router();

router.get("/audit-logs", auth(Role.ADMIN), AdminController.listAuditLogs);
router.get(
	"/dashboard/stats",
	auth(Role.ADMIN),
	AdminController.getDashboardStats,
);

export const AdminRouter = router;
