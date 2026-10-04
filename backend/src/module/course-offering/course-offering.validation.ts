import { z } from "zod";

const CreateZodSchema = z.object({
	courseId: z.uuid(),
	facultyId: z.uuid(),
	semesterId: z.uuid(),
	maxSeats: z.number().int().min(1).max(500).optional(),
});

const UpdateZodSchema = z.object({
	maxSeats: z.number().int().min(1).max(500),
});

const AssignFacultyZodSchema = z.object({
	facultyId: z.uuid(),
});

export const CourseOfferingValidation = {
	CreateZodSchema,
	UpdateZodSchema,
	AssignFacultyZodSchema,
};
