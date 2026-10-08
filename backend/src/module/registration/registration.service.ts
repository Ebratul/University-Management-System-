import { Prisma, Role } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor } from "../../interface";
import { createBkashPayment } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { generateSequenceId } from "../../utils/generateId";
import { buildMeta, calculatePagination } from "../../utils/paginationHelper";
import { runSerializable } from "../../utils/withTransaction";
import { PaymentService } from "../payment/payment.service";
import type {
	ICancelRegistrationPayload,
	IRegistrationSelectionPayload,
} from "./registration.interface";
import {
	blockingReason,
	buildQuote,
	expireStaleInvoices,
	getStudentByUserId,
	issuesToError,
	LIVE_REGISTRATION_STATUSES,
	loadRegistrationFor,
	loadStudentContext,
	notEligibleReason,
	OFFERING_INCLUDE,
	REGISTRATION_INCLUDE,
	releaseRegistration,
	type TQuote,
	type TRegistration,
	type TStudent,
} from "./registration.shared";
import { getWindowState, windowMessage } from "./registration.window";

// ------------------------------------------------------------------- DTOs

const PAYABLE_REGISTRATION = ["SUBMITTED", "PAYMENT_PENDING"];

/** What the client sees. Money is integer paisa; flags say what the UI may offer. */
export const toRegistrationDto = (registration: TRegistration) => {
	const invoice = registration.invoice;
	const open = PAYABLE_REGISTRATION.includes(registration.status);
	const payable =
		open &&
		invoice !== null &&
		["UNPAID", "FAILED", "PENDING"].includes(invoice.status) &&
		invoice.expiresAt > new Date() &&
		invoice.totalAmount > 0;
	return {
		...registration,
		canPay: payable,
		canCancel: open && invoice?.status !== "PENDING",
		paymentInProgress: invoice?.status === "PENDING",
		paymentRequired: (invoice?.totalAmount ?? 0) > 0,
	};
};

const loadDto = async (id: string) => {
	const registration = await prisma.courseRegistration.findUniqueOrThrow({
		where: { id },
		include: REGISTRATION_INCLUDE,
	});
	return toRegistrationDto(registration);
};

// ------------------------------------------------------ available courses

const resolveSemesterId = async (
	requested?: string,
): Promise<string | null> => {
	if (requested) return requested;
	const semesters = await prisma.semester.findMany({
		where: {
			deletedAt: null,
			status: { not: "COMPLETED" },
			registrationSetting: { isNot: null },
		},
		include: { registrationSetting: true },
		orderBy: [{ year: "desc" }, { startDate: "desc" }],
		take: 20,
	});
	const rank = (state: ReturnType<typeof getWindowState>) =>
		state === "OPEN" || state === "LATE" ? 0 : state === "NOT_OPEN" ? 1 : 2;
	const sorted = [...semesters].sort(
		(a, b) =>
			rank(getWindowState(a.registrationSetting)) -
			rank(getWindowState(b.registrationSetting)),
	);
	return sorted[0]?.id ?? null;
};

const getAvailable = async (userId: string, semesterIdParam?: string) => {
	await expireStaleInvoices();
	const student = await getStudentByUserId(userId);
	const semesterId = await resolveSemesterId(semesterIdParam);
	if (!semesterId) {
		return { semester: null, courses: [], existingRegistration: null };
	}

	const semester = await prisma.semester.findFirst({
		where: { id: semesterId, deletedAt: null },
		include: { registrationSetting: true },
	});
	if (!semester)
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found.");

	const setting = semester.registrationSetting;
	const state = getWindowState(setting);

	const offerings = await prisma.courseOffering.findMany({
		where: {
			semesterId,
			deletedAt: null,
			registrationEnabled: true,
			course: { deletedAt: null, departmentId: student.departmentId },
			OR: [
				{ semesterLevel: null },
				{ semesterLevel: student.currentSemesterLevel },
			],
		},
		include: OFFERING_INCLUDE,
		orderBy: { course: { courseCode: "asc" } },
	});

	const ctx = await prisma.$transaction((tx) =>
		loadStudentContext(
			tx,
			student.id,
			offerings.map((o) => o.id),
		),
	);

	const existing = await prisma.courseRegistration.findFirst({
		where: {
			studentId: student.id,
			semesterId,
			status: { in: [...LIVE_REGISTRATION_STATUSES] },
		},
		select: { id: true, registrationNo: true, status: true },
	});

	const courses = offerings.map((o) => {
		const problem = blockingReason(ctx, o);
		const taken = ctx.taken.get(o.id) ?? 0;
		return {
			offeringId: o.id,
			courseCode: o.course.courseCode,
			title: o.course.title,
			description: o.course.description,
			credits: o.course.credits,
			courseType: o.course.courseType,
			teacher: o.faculty.name,
			semesterLevel: o.semesterLevel,
			seats: {
				max: o.maxSeats,
				taken,
				remaining: Math.max(0, o.maxSeats - taken),
			},
			prerequisite: o.course.prerequisite
				? {
						courseCode: o.course.prerequisite.courseCode,
						title: o.course.prerequisite.title,
					}
				: null,
			state: problem ? problem.code : "AVAILABLE",
			stateMessage: problem?.message ?? null,
		};
	});

	return {
		semester: {
			id: semester.id,
			code: semester.code,
			year: semester.year,
			status: semester.status,
		},
		student: {
			currentSemesterLevel: student.currentSemesterLevel,
		},
		window: {
			state,
			message: windowMessage(state, setting),
			registrationStart: setting?.registrationStart ?? null,
			registrationEnd: setting?.registrationEnd ?? null,
			lateEnabled: setting?.lateEnabled ?? false,
			lateStart: setting?.lateStart ?? null,
			lateEnd: setting?.lateEnd ?? null,
		},
		fees: {
			theoryRate: setting?.theoryRate ?? 0,
			practicalRate: setting?.practicalRate ?? 0,
			otherRate: setting?.otherRate ?? 0,
			registrationFee: setting?.registrationFee ?? 0,
			lateFee: setting?.lateFee ?? 0,
		},
		limits: {
			minCredits: setting?.minCredits ?? 0,
			maxCredits: setting?.maxCredits ?? 0,
		},
		existingRegistration: existing,
		courses,
	};
};

// ------------------------------------------------- quote -> client summary

const lineFor = (quote: TQuote, offeringId: string) => {
	const line = quote.fees.lines.find((l) => l.offeringId === offeringId);
	if (!line) throw new Error(`No fee line for offering ${offeringId}`);
	return line;
};

const toSummary = (quote: TQuote) => ({
	semester: quote.semester,
	windowState: quote.windowState,
	isLate: quote.isLate,
	limits: { minCredits: quote.minCredits, maxCredits: quote.maxCredits },
	courses: quote.offerings.map((o) => ({
		offeringId: o.id,
		courseCode: o.course.courseCode,
		title: o.course.title,
		courseType: o.course.courseType,
		credits: o.course.credits,
		teacher: o.faculty.name,
		rate: lineFor(quote, o.id).rate,
		amount: lineFor(quote, o.id).amount,
	})),
	fees: {
		theoryCredits: quote.fees.theoryCredits,
		practicalCredits: quote.fees.practicalCredits,
		otherCredits: quote.fees.otherCredits,
		totalCredits: quote.fees.totalCredits,
		theoryRate: quote.fees.theoryRate,
		practicalRate: quote.fees.practicalRate,
		otherRate: quote.fees.otherRate,
		theoryFee: quote.fees.theoryFee,
		practicalFee: quote.fees.practicalFee,
		otherFee: quote.fees.otherFee,
		registrationFee: quote.fees.registrationFee,
		lateFee: quote.fees.lateFee,
		totalAmount: quote.fees.totalAmount,
	},
});

// Validates and prices a selection WITHOUT saving anything.
const preview = async (
	userId: string,
	payload: IRegistrationSelectionPayload,
) => {
	await expireStaleInvoices();
	const student = await getStudentByUserId(userId);
	const quote = await prisma.$transaction((tx) =>
		buildQuote(tx, student, payload.semesterId, payload.offeringIds),
	);

	const issues = [...quote.issues];
	const existing = await prisma.courseRegistration.findFirst({
		where: {
			studentId: student.id,
			semesterId: payload.semesterId,
			status: { in: [...LIVE_REGISTRATION_STATUSES] },
		},
		select: { registrationNo: true },
	});
	if (existing) {
		issues.unshift({
			offeringId: null,
			code: "REGISTRATION_EXISTS",
			message: `You already have registration ${existing.registrationNo} for this semester.`,
		});
	}
	return { valid: issues.length === 0, issues, summary: toSummary(quote) };
};

// ----------------------------------------------------------------- submit

const submit = async (
	userId: string,
	payload: IRegistrationSelectionPayload,
	actor: IActor,
) => {
	await expireStaleInvoices();
	const student = await getStudentByUserId(userId);

	let created: { id: string; autoConfirmed: boolean } | null = null;
	for (let attempt = 1; attempt <= 3 && !created; attempt++) {
		try {
			created = await runSerializable((tx) =>
				createRegistration(tx, student, payload),
			);
		} catch (error) {
			// A random registration/invoice number collided: just draw another.
			const collision =
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002" &&
				/registrationNo|invoiceNo/.test(JSON.stringify(error.meta ?? {}));
			if (!collision || attempt === 3) {
				if (
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === "P2002"
				) {
					throw new AppError(
						httpStatus.CONFLICT,
						"You already have a registration for this semester, or a selected course was just taken. Reload and try again.",
					);
				}
				throw error;
			}
		}
	}
	if (!created) throw new AppError(httpStatus.CONFLICT, "Please try again.");

	const dto = await loadDto(created.id);
	await recordAuditLog({
		action: "REGISTRATION_SUBMITTED",
		entityType: "CourseRegistration",
		entityId: dto.id,
		description: `${dto.registrationNo}: ${dto.items.length} courses, ${dto.totalCredits} credits`,
		actor,
	});
	if (dto.invoice) {
		await recordAuditLog({
			action: "INVOICE_CREATED",
			entityType: "RegistrationInvoice",
			entityId: dto.invoice.id,
			description: `${dto.invoice.invoiceNo}: ${dto.invoice.totalAmount} paisa`,
			actor,
		});
	}
	if (created.autoConfirmed) {
		await recordAuditLog({
			action: "REGISTRATION_CONFIRMED",
			entityType: "CourseRegistration",
			entityId: dto.id,
			description: "No fee due; confirmed on submission.",
			actor,
		});
	}
	return dto;
};

const createRegistration = async (
	tx: Prisma.TransactionClient,
	student: TStudent,
	payload: IRegistrationSelectionPayload,
) => {
	const existing = await tx.courseRegistration.findFirst({
		where: {
			studentId: student.id,
			semesterId: payload.semesterId,
			status: { in: [...LIVE_REGISTRATION_STATUSES] },
		},
		select: { registrationNo: true },
	});
	if (existing) {
		throw new AppError(
			httpStatus.CONFLICT,
			`You already have registration ${existing.registrationNo} for this semester. Cancel it first to register again.`,
		);
	}

	// Everything is validated and priced from the database, inside this
	// transaction, right before the seats are taken.
	const quote = await buildQuote(
		tx,
		student,
		payload.semesterId,
		payload.offeringIds,
	);
	if (quote.issues.length > 0) throw issuesToError(quote.issues);

	const setting = await tx.registrationSetting.findUniqueOrThrow({
		where: { semesterId: payload.semesterId },
	});
	const fees = quote.fees;
	const now = new Date();
	const free = fees.totalAmount === 0;

	const registration = await tx.courseRegistration.create({
		data: {
			registrationNo: generateSequenceId("REG", quote.semester.year),
			status: free ? "CONFIRMED" : "SUBMITTED",
			confirmedAt: free ? now : null,
			isLate: quote.isLate,
			studentId: student.id,
			semesterId: payload.semesterId,
			theoryCredits: fees.theoryCredits,
			practicalCredits: fees.practicalCredits,
			otherCredits: fees.otherCredits,
			totalCredits: fees.totalCredits,
			items: {
				create: quote.offerings.map((o) => ({
					courseOfferingId: o.id,
					courseCode: o.course.courseCode,
					courseTitle: o.course.title,
					courseType: o.course.courseType,
					credits: o.course.credits,
					rate: lineFor(quote, o.id).rate,
					amount: lineFor(quote, o.id).amount,
				})),
			},
			invoice: {
				create: {
					invoiceNo: generateSequenceId("INV", quote.semester.year),
					status: free ? "PAID" : "UNPAID",
					paidAt: free ? now : null,
					studentId: student.id,
					semesterId: payload.semesterId,
					theoryCredits: fees.theoryCredits,
					practicalCredits: fees.practicalCredits,
					otherCredits: fees.otherCredits,
					totalCredits: fees.totalCredits,
					theoryRate: fees.theoryRate,
					practicalRate: fees.practicalRate,
					otherRate: fees.otherRate,
					theoryFee: fees.theoryFee,
					practicalFee: fees.practicalFee,
					otherFee: fees.otherFee,
					registrationFee: fees.registrationFee,
					lateFee: fees.lateFee,
					totalAmount: fees.totalAmount,
					expiresAt: new Date(
						now.getTime() + setting.invoiceValidityHours * 3_600_000,
					),
				},
			},
		},
		select: { id: true },
	});

	// Take the seats. The unique (student, offering) enrolment is the final
	// guard against two registrations for the same course.
	for (const o of quote.offerings) {
		const seats = await tx.enrollment.count({
			where: {
				courseOfferingId: o.id,
				deletedAt: null,
				status: { in: ["PENDING", "ENROLLED"] },
			},
		});
		if (seats >= o.maxSeats) {
			throw new AppError(
				httpStatus.CONFLICT,
				`${o.course.courseCode} just became full.`,
				[{ path: o.id, message: `${o.course.courseCode} just became full.` }],
			);
		}
		const status = free ? "ENROLLED" : "PENDING";
		const previous = await tx.enrollment.findUnique({
			where: {
				studentId_courseOfferingId: {
					studentId: student.id,
					courseOfferingId: o.id,
				},
			},
		});
		if (previous) {
			await tx.enrollment.update({
				where: { id: previous.id },
				data: { status, deletedAt: null },
			});
		} else {
			await tx.enrollment.create({
				data: { studentId: student.id, courseOfferingId: o.id, status },
			});
		}
	}

	return { id: registration.id, autoConfirmed: free };
};

// ------------------------------------------------------------------ reads

const getRegistration = async (id: string, requester: IActor) => {
	await expireStaleInvoices();
	const registration = await loadRegistrationFor(id, requester);
	return toRegistrationDto(registration);
};

const listMine = async (
	userId: string,
	query: { page?: string; limit?: string },
) => {
	await expireStaleInvoices();
	const student = await getStudentByUserId(userId);
	const { page, limit, skip } = calculatePagination(query, ["createdAt"]);
	const where: Prisma.CourseRegistrationWhereInput = { studentId: student.id };
	const [rows, total] = await Promise.all([
		prisma.courseRegistration.findMany({
			where,
			include: REGISTRATION_INCLUDE,
			orderBy: { createdAt: "desc" },
			skip,
			take: limit,
		}),
		prisma.courseRegistration.count({ where }),
	]);
	return {
		data: rows.map(toRegistrationDto),
		meta: buildMeta(total, page, limit),
	};
};

// ---------------------------------------------------------------- payment

const startPayment = async (registrationId: string, requester: IActor) => {
	await expireStaleInvoices();
	const registration = await loadRegistrationFor(registrationId, requester);
	if (requester.role !== Role.STUDENT) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only the student can pay their invoice.",
		);
	}
	const invoice = registration.invoice;
	if (!invoice) throw new AppError(httpStatus.NOT_FOUND, "Invoice not found.");

	if (invoice.status === "PAID" || registration.status === "CONFIRMED") {
		throw new AppError(
			httpStatus.CONFLICT,
			"This invoice has already been paid.",
		);
	}
	if (invoice.status === "EXPIRED" || registration.status === "EXPIRED") {
		throw new AppError(
			httpStatus.GONE,
			"This invoice has expired. Please register again.",
		);
	}
	if (
		invoice.status === "CANCELLED" ||
		!PAYABLE_REGISTRATION.includes(registration.status)
	) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This registration is no longer payable.",
		);
	}
	if (invoice.totalAmount <= 0) {
		throw new AppError(
			httpStatus.CONFLICT,
			"There is nothing to pay on this invoice.",
		);
	}

	// "Pay now" twice reuses the checkout that is already open.
	const open = await prisma.payment.findFirst({
		where: { registrationInvoiceId: invoice.id, status: "PENDING" },
		orderBy: { createdAt: "desc" },
	});
	if (open?.checkoutUrl) {
		return { payment: open, bkashURL: open.checkoutUrl, reused: true };
	}

	// Claim the invoice atomically so two clicks cannot start two payments.
	const previousStatus = invoice.status;
	const claimed = await prisma.registrationInvoice.updateMany({
		where: { id: invoice.id, status: { in: ["UNPAID", "FAILED"] } },
		data: { status: "PENDING" },
	});
	if (claimed.count === 0) {
		throw new AppError(
			httpStatus.CONFLICT,
			"A payment is already being started. Please wait a moment and try again.",
		);
	}

	const attempt =
		(await prisma.payment.count({
			where: { registrationInvoiceId: invoice.id },
		})) + 1;
	let checkout: Awaited<ReturnType<typeof createBkashPayment>>;
	try {
		// The amount comes from the stored invoice, never from the request.
		checkout = await createBkashPayment({
			amount: invoice.totalAmount / 100,
			invoiceNumber: `${invoice.invoiceNo}-${attempt}`,
		});
		if (!checkout?.paymentID || !checkout.bkashURL) {
			throw new AppError(
				httpStatus.BAD_GATEWAY,
				"The payment gateway did not return a checkout page.",
			);
		}
	} catch (error) {
		await prisma.registrationInvoice.updateMany({
			where: { id: invoice.id, status: "PENDING" },
			data: { status: previousStatus },
		});
		throw error;
	}

	let payment: Awaited<ReturnType<typeof prisma.payment.create>>;
	try {
		payment = await prisma.payment.create({
			data: {
				amount: invoice.totalAmount / 100,
				gatewayPaymentId: checkout.paymentID,
				status: "PENDING",
				studentId: registration.student.id,
				semesterId: invoice.semesterId,
				registrationInvoiceId: invoice.id,
				checkoutUrl: checkout.bkashURL,
			},
		});
	} catch (error) {
		await prisma.registrationInvoice.updateMany({
			where: { id: invoice.id, status: "PENDING" },
			data: { status: previousStatus },
		});
		throw error;
	}
	await prisma.courseRegistration.updateMany({
		where: { id: registration.id, status: "SUBMITTED" },
		data: { status: "PAYMENT_PENDING" },
	});

	await recordAuditLog({
		action: "PAYMENT_INITIATED",
		entityType: "Payment",
		entityId: payment.id,
		description: `${invoice.invoiceNo} (attempt ${attempt})`,
		actor: requester,
	});

	return { payment, bkashURL: checkout.bkashURL, reused: false };
};

// Asks bKash about a payment that is still PENDING (callback never arrived).
const refreshPayment = async (registrationId: string, requester: IActor) => {
	const registration = await loadRegistrationFor(registrationId, requester);
	const open = await prisma.payment.findFirst({
		where: {
			registrationInvoiceId: registration.invoice?.id,
			status: "PENDING",
		},
		orderBy: { createdAt: "desc" },
	});
	if (open) await PaymentService.refreshPendingPayment(open.id);
	return loadDto(registration.id);
};

// ----------------------------------------------------------------- cancel

const cancel = async (
	registrationId: string,
	payload: ICancelRegistrationPayload,
	requester: IActor,
) => {
	const registration = await loadRegistrationFor(registrationId, requester);
	if (!PAYABLE_REGISTRATION.includes(registration.status)) {
		throw new AppError(
			httpStatus.CONFLICT,
			`A ${registration.status.toLowerCase().replace("_", " ")} registration cannot be cancelled.`,
		);
	}
	if (registration.invoice?.status === "PENDING") {
		throw new AppError(
			httpStatus.CONFLICT,
			"A payment is in progress. Wait for it to finish, then try again.",
		);
	}
	const reject = requester.role === Role.ADMIN && payload.reject === true;

	await prisma.$transaction(async (tx) => {
		const closed = await tx.registrationInvoice.updateMany({
			where: {
				id: registration.invoice?.id,
				status: { in: ["UNPAID", "FAILED"] },
			},
			data: { status: "CANCELLED" },
		});
		if (closed.count === 0) {
			throw new AppError(
				httpStatus.CONFLICT,
				"This registration changed while you were cancelling it. Reload and check.",
			);
		}
		await releaseRegistration(
			tx,
			registration.id,
			reject ? "REJECTED" : "CANCELLED",
			payload.reason,
		);
	});

	await recordAuditLog({
		action: reject ? "REGISTRATION_REJECTED" : "REGISTRATION_CANCELLED",
		entityType: "CourseRegistration",
		entityId: registration.id,
		description: payload.reason ?? registration.registrationNo,
		actor: requester,
	});
	return loadDto(registration.id);
};

export const RegistrationService = {
	getAvailable,
	preview,
	submit,
	getRegistration,
	listMine,
	startPayment,
	refreshPayment,
	cancel,
};

// Re-exported for the admin service and tests.
export { blockingReason, notEligibleReason };
