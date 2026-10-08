import { z } from "zod";

const SelectionZodSchema = z.object({
	semesterId: z.uuid("Invalid semester id."),
	// The server looks everything up; the client only says WHICH courses.
	offeringIds: z
		.array(z.uuid("Invalid course offering id."))
		.max(40, "Too many courses selected.")
		.refine((ids) => new Set(ids).size === ids.length, {
			message: "A course can be selected only once.",
		}),
});

const AvailableQuerySchema = z.object({
	semesterId: z.uuid().optional(),
});

const CancelZodSchema = z.object({
	reason: z.string().trim().max(300).optional(),
	reject: z.boolean().optional(),
});

const AdminListQuerySchema = z.object({
	page: z.string().optional(),
	limit: z.string().optional(),
	sortBy: z.string().optional(),
	sortOrder: z.string().optional(),
	searchTerm: z.string().trim().max(100).optional(),
	semesterId: z.uuid().optional(),
	departmentId: z.uuid().optional(),
	courseId: z.uuid().optional(),
	status: z
		.enum([
			"DRAFT",
			"SUBMITTED",
			"PAYMENT_PENDING",
			"PAID",
			"CONFIRMED",
			"CANCELLED",
			"REJECTED",
			"EXPIRED",
		])
		.optional(),
	paymentStatus: z
		.enum(["UNPAID", "PENDING", "PAID", "FAILED", "CANCELLED", "EXPIRED"])
		.optional(),
});

export const RegistrationValidation = {
	SelectionZodSchema,
	AvailableQuerySchema,
	CancelZodSchema,
	AdminListQuerySchema,
};
