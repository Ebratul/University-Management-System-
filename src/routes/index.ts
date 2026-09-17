import { Router } from "express";
import httpStatus from "http-status";
import { prisma } from "../lib/prisma";
import { AuthRouter } from "../module/auth/auth.router";
import { CourseOfferingRouter } from "../module/course-offering/course-offering.router";
import { CourseRouter } from "../module/course/course.router";
import { DepartmentRouter } from "../module/department/department.router";
import { EnrollmentRouter } from "../module/enrollment/enrollment.router";
import { FacultyRouter } from "../module/faculty/faculty.router";
import { NoticeRouter } from "../module/notice/notice.router";
import { PaymentRouter } from "../module/payment/payment.router";
import { ResultRouter } from "../module/result/result.router";
import { SemesterRouter } from "../module/semester/semester.router";
import { StudentRouter } from "../module/student/student.router";
import { UserRoutes } from "../module/user/user.router";

const router = Router();

router.get("/health", async (_req, res) => {
	try {
		await prisma.$queryRaw`SELECT 1`;
		res.status(httpStatus.OK).json({
			success: true,
			statusCode: httpStatus.OK,
			message: "API is healthy",
			data: { database: "up", timestamp: new Date().toISOString() },
		});
	} catch {
		res.status(httpStatus.SERVICE_UNAVAILABLE).json({
			success: false,
			statusCode: httpStatus.SERVICE_UNAVAILABLE,
			message: "Database is unreachable",
			errors: undefined,
		});
	}
});

router.use("/auth", AuthRouter);
router.use("/users", UserRoutes);
router.use("/departments", DepartmentRouter);
router.use("/faculties", FacultyRouter);
router.use("/students", StudentRouter);
router.use("/courses", CourseRouter);
router.use("/semesters", SemesterRouter);
router.use("/course-offerings", CourseOfferingRouter);
router.use("/enrollments", EnrollmentRouter);
router.use("/results", ResultRouter);
router.use("/notices", NoticeRouter);
router.use("/payments", PaymentRouter);

// Remaining feature module routers are mounted here as they land.

export const apiRouter = router;
