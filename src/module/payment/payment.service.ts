import { PaymentStatus, Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor } from "../../interface";
import {
	createBkashPayment,
	executeBkashPayment,
	queryBkashPayment,
} from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { PAYMENT_SORTABLE_FIELDS } from "./payment.constant";
import type {
	IInitiatePaymentPayload,
	IPaymentCallbackQuery,
	IPaymentListQuery,
} from "./payment.interface";

const RELATION_SELECT = {
	student: { select: { id: true, studentId: true, name: true, userId: true } },
	semester: { select: { id: true, code: true, year: true } },
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
const finalizePayment = async (
	id: string,
	data: Prisma.PaymentUpdateInput,
	ip?: string,
) => {
	await prisma.payment.updateMany({
		where: { id, status: PaymentStatus.PENDING },
		data,
	});
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
	}

	return updated;
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
	getPaymentById,
	listPayments,
};
