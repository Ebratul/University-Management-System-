import type { Payment } from "@prisma/client";

import type { Tx } from "./registration.shared";

export type TRegistrationPaymentOutcome =
	| "NOT_A_REGISTRATION_PAYMENT"
	| "CONFIRMED"
	| "PAYMENT_FAILED_RECORDED"
	| "UNMATCHED";

/**
 * Applies the final result of a bKash payment to the registration it paid for.
 * It runs INSIDE the transaction that settles the payment itself, so the
 * payment, invoice, registration and enrolments can never disagree:
 *   PAID  -> invoice PAID, registration CONFIRMED, enrolments ENROLLED
 *   FAILED -> invoice FAILED (the student can retry; nothing else changes)
 */
export const applyRegistrationPaymentResult = async (
	tx: Tx,
	payment: Pick<Payment, "status" | "registrationInvoiceId" | "paidAt">,
): Promise<TRegistrationPaymentOutcome> => {
	const invoiceId = payment.registrationInvoiceId;
	if (!invoiceId) return "NOT_A_REGISTRATION_PAYMENT";

	if (payment.status !== "PAID") {
		await tx.registrationInvoice.updateMany({
			where: { id: invoiceId, status: "PENDING" },
			data: { status: "FAILED" },
		});
		return "PAYMENT_FAILED_RECORDED";
	}

	const invoice = await tx.registrationInvoice.findUnique({
		where: { id: invoiceId },
		include: { registration: { include: { items: true } } },
	});
	if (!invoice) return "UNMATCHED";

	// Conditional: an invoice already paid, expired or cancelled is left alone,
	// so a repeated settlement can never confirm twice.
	const paid = await tx.registrationInvoice.updateMany({
		where: { id: invoiceId, status: { in: ["UNPAID", "PENDING", "FAILED"] } },
		data: { status: "PAID", paidAt: payment.paidAt ?? new Date() },
	});
	if (paid.count === 0) return "UNMATCHED";

	const registration = invoice.registration;
	if (!["SUBMITTED", "PAYMENT_PENDING"].includes(registration.status)) {
		// Money arrived for a registration that was closed meanwhile. The payment
		// is recorded as PAID; an admin has to resolve it (the caller audit-logs it).
		return "UNMATCHED";
	}

	await tx.courseRegistration.update({
		where: { id: registration.id },
		data: { status: "CONFIRMED", confirmedAt: new Date() },
	});

	for (const item of registration.items) {
		const reserved = await tx.enrollment.updateMany({
			where: {
				studentId: registration.studentId,
				courseOfferingId: item.courseOfferingId,
				status: "PENDING",
				deletedAt: null,
			},
			data: { status: "ENROLLED" },
		});
		if (reserved.count === 0) {
			// The reservation was lost somehow, but the student has paid: enrol them.
			await tx.enrollment.upsert({
				where: {
					studentId_courseOfferingId: {
						studentId: registration.studentId,
						courseOfferingId: item.courseOfferingId,
					},
				},
				update: { status: "ENROLLED", deletedAt: null },
				create: {
					studentId: registration.studentId,
					courseOfferingId: item.courseOfferingId,
					status: "ENROLLED",
				},
			});
		}
	}
	return "CONFIRMED";
};
