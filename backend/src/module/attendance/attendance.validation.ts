import { z } from "zod";

const dateOnly = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
	.refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
		message: "Invalid date.",
	});

const MarkZodSchema = z.object({
	date: dateOnly,
	records: z
		.array(
			z.object({
				studentId: z.uuid("Invalid student id."),
				status: z.enum(["PRESENT", "ABSENT"]),
			}),
		)
		.min(1, "Provide at least one attendance record.")
		.max(500)
		.refine(
			(records) =>
				new Set(records.map((r) => r.studentId)).size === records.length,
			{ message: "Each student can appear only once." },
		),
});

const RosterQuerySchema = z.object({ date: dateOnly.optional() });

export const AttendanceValidation = { MarkZodSchema, RosterQuerySchema };
