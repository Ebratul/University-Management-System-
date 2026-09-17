import { Router } from "express";
import httpStatus from "http-status";
import { prisma } from "../lib/prisma";
import { redisClient } from "../lib/redis";
import { AdminRouter } from "../module/admin/admin.router";
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
	const [dbResult, redisResult] = await Promise.allSettled([
		prisma.$queryRaw`SELECT 1`,
		redisClient.ping(),
	]);

	const database = dbResult.status === "fulfilled" ? "up" : "down";
	const redis = redisResult.status === "fulfilled" ? "up" : "down";
	const healthy = database === "up" && redis === "up";

	res.status(healthy ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE).json({
		success: healthy,
		statusCode: healthy ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE,
		message: healthy
			? "API is healthy"
			: "One or more dependencies are unreachable",
		data: { database, redis, timestamp: new Date().toISOString() },
	});
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
router.use("/admin", AdminRouter);

// Remaining feature module routers are mounted here as they land.

export const apiRouter = router;
