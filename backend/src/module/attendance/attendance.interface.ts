import type { AttendanceStatus } from "@prisma/client";

export interface IMarkAttendancePayload {
	date: string; // YYYY-MM-DD
	records: { studentId: string; status: AttendanceStatus }[];
}
