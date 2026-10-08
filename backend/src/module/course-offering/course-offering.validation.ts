import { z } from "zod";

const semesterLevel = z.number().int().min(1).max(12);

const CreateZodSchema = z.object({
	courseId: z.uuid(),
	facultyId: z.uuid(),
	semesterId: z.uuid(),
	maxSeats: z.number().int().min(1).max(500).optional(),
	// Which semester level of the department this is offered to (null = every level).
	semesterLevel: semesterLevel.nullable().optional(),
	registrationEnabled: z.boolean().optional(),
});

const UpdateZodSchema = z
	.object({
		maxSeats: z.number().int().min(1).max(500).optional(),
		semesterLevel: semesterLevel.nullable().optional(),
		registrationEnabled: z.boolean().optional(),
	})
	.refine((v) => Object.keys(v).length > 0, {
		message: "Provide at least one field to update.",
	});

const AssignFacultyZodSchema = z.object({
	facultyId: z.uuid(),
});

export const CourseOfferingValidation = {
	CreateZodSchema,
	UpdateZodSchema,
	AssignFacultyZodSchema,
};
