import type { CourseType } from "@prisma/client";

/**
 * Credit-fee arithmetic. Every amount is an integer number of paisa
 * (100 paisa = 1 BDT) and credits are handled as integer hundredths, so there
 * is no floating-point money anywhere: 1.5 credits at 160 BDT is exactly
 * 150 * 16000 / 100 = 24000 paisa.
 */

export type TFeeRates = {
	theoryRate: number;
	practicalRate: number;
	otherRate: number;
	registrationFee: number;
	lateFee: number;
};

export type TFeeCourse = {
	offeringId: string;
	credits: number;
	courseType: CourseType;
};

export type TFeeLine = TFeeCourse & { rate: number; amount: number };

export type TFeeBreakdown = {
	lines: TFeeLine[];
	theoryCredits: number;
	practicalCredits: number;
	otherCredits: number;
	totalCredits: number;
	theoryRate: number;
	practicalRate: number;
	otherRate: number;
	theoryFee: number;
	practicalFee: number;
	otherFee: number;
	registrationFee: number;
	lateFee: number;
	totalAmount: number;
};

const centi = (credits: number) => Math.round(credits * 100);

export const rateFor = (type: CourseType, rates: TFeeRates): number => {
	if (type === "THEORY") return rates.theoryRate;
	if (type === "PRACTICAL") return rates.practicalRate;
	// PROJECT, THESIS and OTHER share one rate.
	return rates.otherRate;
};

const group = (type: CourseType): "theory" | "practical" | "other" =>
	type === "THEORY" ? "theory" : type === "PRACTICAL" ? "practical" : "other";

export const calculateFees = (
	courses: TFeeCourse[],
	rates: TFeeRates,
	isLate: boolean,
): TFeeBreakdown => {
	const lines: TFeeLine[] = courses.map((course) => {
		const rate = rateFor(course.courseType, rates);
		return {
			...course,
			rate,
			// credits (hundredths) x paisa per credit / 100, rounded to a whole paisa
			amount: Math.round((centi(course.credits) * rate) / 100),
		};
	});

	const credits = { theory: 0, practical: 0, other: 0 };
	const fees = { theory: 0, practical: 0, other: 0 };
	for (const line of lines) {
		credits[group(line.courseType)] += centi(line.credits);
		fees[group(line.courseType)] += line.amount;
	}

	const lateFee = isLate ? rates.lateFee : 0;
	return {
		lines,
		theoryCredits: credits.theory / 100,
		practicalCredits: credits.practical / 100,
		otherCredits: credits.other / 100,
		totalCredits: (credits.theory + credits.practical + credits.other) / 100,
		theoryRate: rates.theoryRate,
		practicalRate: rates.practicalRate,
		otherRate: rates.otherRate,
		theoryFee: fees.theory,
		practicalFee: fees.practical,
		otherFee: fees.other,
		registrationFee: rates.registrationFee,
		lateFee,
		totalAmount:
			fees.theory +
			fees.practical +
			fees.other +
			rates.registrationFee +
			lateFee,
	};
};
