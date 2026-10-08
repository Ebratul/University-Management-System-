import { z } from "zod";

const paisa = z.number().int().min(0).max(1_000_000_000);
const credits = z.number().min(0).max(60);

const UpsertZodSchema = z
	.object({
		theoryRate: paisa,
		practicalRate: paisa,
		otherRate: paisa,
		registrationFee: paisa,
		minCredits: credits,
		maxCredits: credits,
		registrationStart: z.coerce.date().nullable(),
		registrationEnd: z.coerce.date().nullable(),
		lateEnabled: z.boolean(),
		lateStart: z.coerce.date().nullable(),
		lateEnd: z.coerce.date().nullable(),
		lateFee: paisa,
		invoiceValidityHours: z
			.number()
			.int()
			.min(1)
			.max(24 * 30),
	})
	.superRefine((v, ctx) => {
		const issue = (path: string, message: string) =>
			ctx.addIssue({ code: "custom", path: [path], message });

		if (v.maxCredits < v.minCredits) {
			issue("maxCredits", "Maximum credits cannot be less than the minimum.");
		}
		if ((v.registrationStart === null) !== (v.registrationEnd === null)) {
			issue(
				"registrationEnd",
				"Set both the start and the end of registration.",
			);
		}
		if (
			v.registrationStart &&
			v.registrationEnd &&
			v.registrationEnd <= v.registrationStart
		) {
			issue("registrationEnd", "Registration must end after it starts.");
		}
		if (v.lateEnabled) {
			if (!v.lateStart || !v.lateEnd) {
				issue("lateStart", "Set the late registration start and end.");
			} else {
				if (v.lateEnd <= v.lateStart) {
					issue("lateEnd", "Late registration must end after it starts.");
				}
				if (v.registrationEnd && v.lateStart < v.registrationEnd) {
					issue(
						"lateStart",
						"Late registration must start after regular registration ends.",
					);
				}
			}
		}
	});

export const RegistrationSettingValidation = { UpsertZodSchema };
