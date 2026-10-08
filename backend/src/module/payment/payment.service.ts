import type { Prisma } from "@prisma/client";
import { PaymentStatus, Role } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor } from "../../interface";
import {
	createBkashPayment,
	executeBkashPayment,
	type IBkashExecutePaymentResult,
	queryBkashPayment,
} from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { applyRegistrationPaymentResult } from "../registration/registration.payment";
import { PAYMENT_SORTABLE_FIELDS } from "./payment.constant";
import type {
	IInitiatePaymentPayload,
	IPaymentCallbackQuery,
	IPaymentListQuery,
} from "./payment.interface";

const RELATION_SELECT = {
	student: { select: { id: true, studentId: true, name: true, userId: true } },
	semester: { select: { id: true, code: true, year: true } },
	// Present when the payment is for a course-registration invoice.
	registrationInvoice: {
		select: { id: true, invoiceNo: true, registrationId: true },
	},
} satisfies Prisma.PaymentInclude;

const initiatePayment = async (
	studentUserId: string,
	payload: IInitiatePaymentPayload,
	actor: IActor,
) => {
	const student = await prisma.student.findFirst({
		where: { userId: studentUserId, deletedAt: null },
	});
	if (!student) {
		throw new AppError(httpStatus.NOT_FOUND, "Student profile not found.");
	}

	const semester = await prisma.semester.findFirst({
		where: { id: payload.semesterId, deletedAt: null },
	});
	if (!semester) {
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found.");
	}
	if (semester.feeAmount <= 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"No fee is configured for this semester yet. Ask an admin to set one.",
		);
	}

	const invoiceNumber = `INV-${student.studentId}-${Date.now()}`;
	const bkashResult = await createBkashPayment({
		amount: semester.feeAmount,
		invoiceNumber,
	});

	const payment = await prisma.payment.create({
		data: {
			amount: semester.feeAmount,
			gatewayPaymentId: bkashResult.paymentID,
			status: PaymentStatus.PENDING,
			studentId: student.id,
			semesterId: semester.id,
		},
		include: RELATION_SELECT,
	});

	await recordAuditLog({
		action: "PAYMENT_INITIATED",
		entityType: "Payment",
		entityId: payment.id,
		description: invoiceNumber,
		actor,
	});

	return { payment, bkashURL: bkashResult.bkashURL };
};

// Atomic conditional update: only succeeds if the payment is still PENDING,
// so a duplicate/racing callback for the same paymentID can't process twice.
// For a course-registration payment the invoice, registration and enrolments
// are settled in the SAME transaction, so they can never disagree with it.
const finalizePayment = async (
	id: string,
	data: Prisma.PaymentUpdateInput,
	ip?: string,
) => {
	const settled = await prisma.$transaction(async (tx) => {
		const result = await tx.payment.updateMany({
			where: { id, status: PaymentStatus.PENDING },
			data,
		});
		if (result.count === 0) return null;

		const payment = await tx.payment.findUniqueOrThrow({ where: { id } });
		const outcome = await applyRegistrationPaymentResult(tx, payment);
		return { payment, outcome };
	});

	if (!settled) {
		return prisma.payment.findUnique({
			where: { id },
			include: RELATION_SELECT,
		});
	}

	const updated = await prisma.payment.findUnique({
		where: { id },
		include: RELATION_SELECT,
	});

	if (updated) {
		await recordAuditLog({
			action:
				updated.status === PaymentStatus.PAID
					? "PAYMENT_COMPLETED"
					: "PAYMENT_FAILED",
			entityType: "Payment",
			entityId: updated.id,
			description: updated.failureReason ?? updated.transactionId ?? undefined,
			actor: { ip },
		});
		if (settled.outcome === "CONFIRMED") {
			await recordAuditLog({
				action: "REGISTRATION_CONFIRMED",
				entityType: "CourseRegistration",
				entityId: updated.registrationInvoice?.registrationId,
				description: updated.registrationInvoice?.invoiceNo,
				actor: { ip },
			});
		} else if (settled.outcome === "UNMATCHED") {
			// Money was taken but the invoice could not be marked paid (it was
			// already settled, expired or cancelled). Needs a human.
			await recordAuditLog({
				action: "REGISTRATION_PAYMENT_UNMATCHED",
				entityType: "Payment",
				entityId: updated.id,
				description: `Payment ${updated.transactionId ?? updated.id} for invoice ${updated.registrationInvoice?.invoiceNo ?? "?"} could not be applied.`,
				actor: { ip },
			});
		}
	}

	return updated;
};

const toPaisa = (taka: number) => Math.round(taka * 100);

// Cross-checks what the gateway says it charged against what we asked for.
// Fields bKash does not echo back are skipped; any that it does must match.
const gatewayMismatch = (
	payment: {
		amount: number;
		registrationInvoice?: { invoiceNo: string } | null;
	},
	result: IBkashExecutePaymentResult,
): string | null => {
	if (
		result.amount !== undefined &&
		toPaisa(Number(result.amount)) !== toPaisa(payment.amount)
	) {
		return `Amount mismatch: expected ${payment.amount.toFixed(2)}, gateway reported ${result.amount}.`;
	}
	if (result.currency !== undefined && result.currency !== "BDT") {
		return `Unexpected currency ${result.currency}.`;
	}
	if (
		payment.registrationInvoice &&
		result.merchantInvoiceNumber !== undefined &&
		!result.merchantInvoiceNumber.startsWith(
			payment.registrationInvoice.invoiceNo,
		)
	) {
		return "The gateway reported a different invoice number.";
	}
	return null;
};

// Deliberately NOT wrapped in a DB transaction: it makes two outbound calls
// to bKash, and holding a Postgres transaction open across slow network I/O
// risks pool exhaustion and the 5s default transaction timeout. The
// conditional update in finalizePayment is what actually prevents a
// duplicate callback from double-processing, not transaction isolation.
const handleCallback = async (query: IPaymentCallbackQuery, ip?: string) => {
	const { paymentID, status } = query;
	if (!paymentID) {
		throw new AppError(httpStatus.BAD_REQUEST, "Missing paymentID.");
	}

	const payment = await prisma.payment.findUnique({
		where: { gatewayPaymentId: paymentID },
		include: { registrationInvoice: { select: { invoiceNo: true } } },
	});
	if (!payment) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"No payment found for this gateway reference.",
		);
	}

	if (payment.status !== PaymentStatus.PENDING) {
		return prisma.payment.findUnique({
			where: { id: payment.id },
			include: RELATION_SELECT,
		});
	}

	if (status !== "success") {
		return finalizePayment(
			payment.id,
			{ status: PaymentStatus.FAILED, failureReason: status ?? "unknown" },
			ip,
		);
	}

	const executed = await executeBkashPayment(paymentID);
	if (executed.transactionStatus !== "Completed") {
		return finalizePayment(
			payment.id,
			{ status: PaymentStatus.FAILED, failureReason: executed.statusMessage },
			ip,
		);
	}

	// Cross-check with a separate query call before trusting execute's response.
	const verified = await queryBkashPayment(paymentID);
	if (verified.transactionStatus !== "Completed") {
		return finalizePayment(
			payment.id,
			{
				status: PaymentStatus.FAILED,
				failureReason: "Verification query did not confirm completion.",
			},
			ip,
		);
	}

	const mismatch =
		gatewayMismatch(payment, executed) ?? gatewayMismatch(payment, verified);
	if (mismatch) {
		await recordAuditLog({
			action: "PAYMENT_VERIFICATION_MISMATCH",
			entityType: "Payment",
			entityId: payment.id,
			description: mismatch,
			actor: { ip },
		});
		return finalizePayment(
			payment.id,
			{ status: PaymentStatus.FAILED, failureReason: mismatch },
			ip,
		);
	}

	return finalizePayment(
		payment.id,
		{
			status: PaymentStatus.PAID,
			transactionId: executed.trxID,
			paidAt: new Date(),
		},
		ip,
	);
};

// A payment can sit PENDING if the payer closed the bKash page and the callback
// never reached us. This asks bKash what really happened and settles it the
// same way the callback would (verified, amount-checked, idempotent).
const STALE_PENDING_MS = 30 * 60 * 1000;
const FAILED_GATEWAY_STATES = new Set(["Failed", "Cancelled", "Expired"]);

const refreshPendingPayment = async (paymentId: string, ip?: string) => {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: { registrationInvoice: { select: { invoiceNo: true } } },
	});
	if (!payment) throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
	if (payment.status !== PaymentStatus.PENDING) {
		return prisma.payment.findUnique({
			where: { id: payment.id },
			include: RELATION_SELECT,
		});
	}

	let queried: IBkashExecutePaymentResult;
	try {
		queried = await queryBkashPayment(payment.gatewayPaymentId);
	} catch {
		// Leave it PENDING: not being able to reach bKash proves nothing.
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"Could not reach bKash to check this payment. Please try again shortly.",
		);
	}

	const state = queried.transactionStatus;
	const stale = Date.now() - payment.createdAt.getTime() > STALE_PENDING_MS;

	if (state === "Completed") {
		const mismatch = gatewayMismatch(payment, queried);
		if (mismatch) {
			return finalizePayment(
				payment.id,
				{ status: PaymentStatus.FAILED, failureReason: mismatch },
				ip,
			);
		}
		return finalizePayment(
			payment.id,
			{
				status: PaymentStatus.PAID,
				transactionId: queried.trxID,
				paidAt: new Date(),
			},
			ip,
		);
	}

	if (state === "Authorized") {
		// The payer approved but we never captured: capture now, then verify.
		const executed = await executeBkashPayment(payment.gatewayPaymentId);
		const mismatch = gatewayMismatch(payment, executed);
		if (executed.transactionStatus === "Completed" && !mismatch) {
			return finalizePayment(
				payment.id,
				{
					status: PaymentStatus.PAID,
					transactionId: executed.trxID,
					paidAt: new Date(),
				},
				ip,
			);
		}
		return finalizePayment(
			payment.id,
			{
				status: PaymentStatus.FAILED,
				failureReason: mismatch ?? executed.statusMessage ?? "Capture failed.",
			},
			ip,
		);
	}

	if (
		(state && FAILED_GATEWAY_STATES.has(state)) ||
		(stale && state !== "Authorized")
	) {
		return finalizePayment(
			payment.id,
			{
				status: PaymentStatus.FAILED,
				failureReason:
					queried.statusMessage || state || "Checkout was not completed.",
			},
			ip,
		);
	}

	// Still being paid (or too fresh to judge): report it as it is.
	return prisma.payment.findUnique({
		where: { id: payment.id },
		include: RELATION_SELECT,
	});
};

const getPaymentById = async (id: string, requester: IActor) => {
	const payment = await prisma.payment.findFirst({
		where: { id, deletedAt: null },
		include: RELATION_SELECT,
	});
	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
	}

	if (
		requester.role === Role.STUDENT &&
		payment.student.userId !== requester.userId
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view your own payments.",
		);
	}

	return payment;
};

const listPayments = async (query: IPaymentListQuery, requester: IActor) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(
		query,
		PAYMENT_SORTABLE_FIELDS,
	);

	const andConditions: Prisma.PaymentWhereInput[] = [{ deletedAt: null }];

	if (requester.role === Role.STUDENT) {
		const student = await prisma.student.findFirst({
			where: { userId: requester.userId, deletedAt: null },
		});
		if (!student)
			throw new AppError(httpStatus.FORBIDDEN, "Student profile not found.");
		andConditions.push({ studentId: student.id });
	} else if (query.studentId) {
		andConditions.push({ studentId: query.studentId });
	}

	if (query.status)
		andConditions.push({ status: query.status as PaymentStatus });
	if (query.semesterId) andConditions.push({ semesterId: query.semesterId });

	const where: Prisma.PaymentWhereInput = { AND: andConditions };

	const [data, total] = await Promise.all([
		prisma.payment.findMany({
			where,
			include: RELATION_SELECT,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.payment.count({ where }),
	]);

	return { data, meta: buildMeta(total, page, limit) };
};

export const PaymentService = {
	initiatePayment,
	handleCallback,
	refreshPendingPayment,
	getPaymentById,
	listPayments,
};
