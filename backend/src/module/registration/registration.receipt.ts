import type { Response } from "express";
import httpStatus from "http-status";
import PDFDocument from "pdfkit";

import type { IActor } from "../../interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { loadRegistrationFor } from "./registration.shared";

export const formatBdt = (paisa: number) =>
	`BDT ${(paisa / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Only a confirmed, paid registration has a receipt.
export const getReceiptData = async (
	registrationId: string,
	requester: IActor,
) => {
	const registration = await loadRegistrationFor(registrationId, requester);
	const invoice = registration.invoice;
	if (
		registration.status !== "CONFIRMED" ||
		!invoice ||
		invoice.status !== "PAID"
	) {
		throw new AppError(
			httpStatus.CONFLICT,
			"A receipt is available once the registration is confirmed and paid.",
		);
	}

	const [settings, payment] = await Promise.all([
		prisma.websiteSettings.findUnique({
			where: { id: "global" },
			select: { universityName: true },
		}),
		prisma.payment.findFirst({
			where: { registrationInvoiceId: invoice.id, status: "PAID" },
			orderBy: { paidAt: "desc" },
			select: {
				id: true,
				transactionId: true,
				paidAt: true,
				paymentMethod: true,
			},
		}),
	]);

	return {
		universityName: settings?.universityName ?? "University Management System",
		student: {
			name: registration.student.name,
			studentId: registration.student.studentId,
			registrationNumber: registration.student.registrationNumber,
			department: registration.student.department.name,
		},
		semester: `${registration.semester.code} ${registration.semester.year}`,
		registration: {
			id: registration.id,
			registrationNo: registration.registrationNo,
			confirmedAt: registration.confirmedAt,
			isLate: registration.isLate,
		},
		invoice: {
			invoiceNo: invoice.invoiceNo,
			paidAt: invoice.paidAt,
			theoryCredits: invoice.theoryCredits,
			practicalCredits: invoice.practicalCredits,
			otherCredits: invoice.otherCredits,
			totalCredits: invoice.totalCredits,
			theoryRate: invoice.theoryRate,
			practicalRate: invoice.practicalRate,
			otherRate: invoice.otherRate,
			theoryFee: invoice.theoryFee,
			practicalFee: invoice.practicalFee,
			otherFee: invoice.otherFee,
			registrationFee: invoice.registrationFee,
			lateFee: invoice.lateFee,
			totalAmount: invoice.totalAmount,
		},
		// Null when the registration had no fee to pay.
		payment,
		courses: registration.items.map((i) => ({
			courseCode: i.courseCode,
			courseTitle: i.courseTitle,
			credits: i.credits,
			courseType: i.courseType,
			amount: i.amount,
		})),
	};
};

type TReceipt = Awaited<ReturnType<typeof getReceiptData>>;

export const writeReceiptPdf = (receipt: TReceipt, res: Response) => {
	const doc = new PDFDocument({ size: "A4", margin: 48 });
	res.setHeader("Content-Type", "application/pdf");
	res.setHeader(
		"Content-Disposition",
		`attachment; filename="receipt-${receipt.registration.registrationNo}.pdf"`,
	);
	doc.pipe(res);

	const right = doc.page.width - 48;
	const row = (label: string, value: string) => {
		const y = doc.y;
		doc
			.font("Helvetica")
			.fillColor("#555555")
			.fontSize(10)
			.text(label, 48, y, { width: 170 });
		doc
			.font("Helvetica-Bold")
			.fillColor("#111111")
			.text(value, 220, y, { width: right - 220 });
		doc.moveDown(0.3);
	};
	const rule = () => {
		doc
			.moveDown(0.4)
			.strokeColor("#dddddd")
			.moveTo(48, doc.y)
			.lineTo(right, doc.y)
			.stroke()
			.moveDown(0.6);
	};

	doc
		.font("Helvetica-Bold")
		.fontSize(18)
		.fillColor("#2f2a7a")
		.text(receipt.universityName, { align: "center" });
	doc
		.moveDown(0.2)
		.font("Helvetica")
		.fontSize(12)
		.fillColor("#333333")
		.text("Course Registration Receipt", { align: "center" });
	rule();

	row("Student", receipt.student.name);
	row("Student ID", receipt.student.studentId);
	row("Registration number", receipt.student.registrationNumber);
	row("Department", receipt.student.department);
	row("Semester", receipt.semester);
	row("Registration ID", receipt.registration.registrationNo);
	row("Invoice", receipt.invoice.invoiceNo);
	if (receipt.payment) {
		row("Payment ID", receipt.payment.transactionId ?? receipt.payment.id);
		row(
			"Payment date",
			receipt.payment.paidAt
				? receipt.payment.paidAt.toISOString().slice(0, 10)
				: "-",
		);
		row("Payment method", receipt.payment.paymentMethod);
	} else {
		row("Payment", "No fee was due");
	}
	rule();

	doc
		.font("Helvetica-Bold")
		.fontSize(11)
		.fillColor("#111111")
		.text("Registered courses");
	doc.moveDown(0.4);
	const header = doc.y;
	doc.font("Helvetica-Bold").fontSize(9).fillColor("#555555");
	doc.text("CODE", 48, header, { width: 70 });
	doc.text("COURSE", 120, header, { width: 250 });
	doc.text("TYPE", 375, header, { width: 70 });
	doc.text("CREDIT", 450, header, { width: right - 450, align: "right" });
	doc.moveDown(0.6);
	for (const c of receipt.courses) {
		const y = doc.y;
		doc.font("Helvetica").fontSize(10).fillColor("#111111");
		doc.text(c.courseCode, 48, y, { width: 70 });
		doc.text(c.courseTitle, 120, y, { width: 250 });
		doc.text(c.courseType, 375, y, { width: 70 });
		doc.text(String(c.credits), 450, y, { width: right - 450, align: "right" });
		doc.moveDown(0.3);
	}
	doc
		.moveDown(0.2)
		.font("Helvetica-Bold")
		.text(`Total credits: ${receipt.invoice.totalCredits}`, 48, doc.y, {
			align: "right",
			width: right - 48,
		});
	rule();

	doc
		.font("Helvetica-Bold")
		.fontSize(11)
		.fillColor("#111111")
		.text("Fee summary", 48);
	doc.moveDown(0.4);
	const fee = (label: string, paisa: number) => row(label, formatBdt(paisa));
	fee("Theory credit fee", receipt.invoice.theoryFee);
	fee("Practical credit fee", receipt.invoice.practicalFee);
	if (receipt.invoice.otherFee > 0)
		fee("Project / thesis credit fee", receipt.invoice.otherFee);
	fee("Registration fee", receipt.invoice.registrationFee);
	fee("Late fee", receipt.invoice.lateFee);
	rule();
	doc.font("Helvetica-Bold").fontSize(13).fillColor("#111111");
	row("Total", formatBdt(receipt.invoice.totalAmount));
	doc
		.moveDown(0.8)
		.font("Helvetica-Bold")
		.fontSize(12)
		.fillColor("#1b7f4b")
		.text("Payment status: PAID", 48);
	doc
		.moveDown(1.2)
		.font("Helvetica")
		.fontSize(8)
		.fillColor("#888888")
		.text(
			"This is a computer-generated receipt. Keep the payment ID for your records.",
			48,
			doc.y,
			{ align: "center", width: right - 48 },
		);
	doc.end();
};
