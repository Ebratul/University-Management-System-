import { Role } from "@prisma/client";
import { Router } from "express";

import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AttendanceController } from "./attendance.controller";
import { AttendanceValidation } from "./attendance.validation";

// Mounted at /course-offerings/:offeringId/attendance
const router = Router({ mergeParams: true });

// Student: own attendance only.
router.get("/me", auth(Role.STUDENT), AttendanceController.getMyAttendance);

// Teacher of the course (or admin). Course ownership is checked in the service.
router.get(
	"/summary",
	auth(Role.FACULTY, Role.ADMIN),
	AttendanceController.getSummary,
);
router.get(
	"/students/:studentId",
	auth(Role.FACULTY, Role.ADMIN),
	AttendanceController.getStudentAttendance,
);
router.get(
	"/",
	auth(Role.FACULTY, Role.ADMIN),
	validateRequest(AttendanceValidation.RosterQuerySchema, "query"),
	AttendanceController.getRoster,
);
router.post(
	"/",
	auth(Role.FACULTY, Role.ADMIN),
	validateRequest(AttendanceValidation.MarkZodSchema),
	AttendanceController.markAttendance,
);

export const AttendanceRouter = router;
