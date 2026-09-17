import { EnrollmentStatus } from "@prisma/client";
import { z } from "zod";

const CreateZodSchema = z.object({
	courseOfferingId: z.uuid(),
});

const UpdateStatusZodSchema = z.object({
	status: z.enum(EnrollmentStatus),
});

export const EnrollmentValidation = { CreateZodSchema, UpdateStatusZodSchema };
