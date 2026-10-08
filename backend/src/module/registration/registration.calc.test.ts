import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	calculateFees,
	type TFeeCourse,
	type TFeeRates,
} from "./registration.calc";

// 120 BDT theory, 160 BDT practical, 500 BDT registration fee, in paisa.
const rates: TFeeRates = {
	theoryRate: 12000,
	practicalRate: 16000,
	otherRate: 20000,
	registrationFee: 50000,
	lateFee: 20000,
};

const course = (
	id: string,
	credits: number,
	courseType: TFeeCourse["courseType"],
): TFeeCourse => ({
	offeringId: id,
	credits,
	courseType,
});

describe("credit fee calculation", () => {
	test("the worked example: 9 theory + 1.5 practical credits", () => {
		const fees = calculateFees(
			[
				course("a", 3, "THEORY"),
				course("b", 3, "THEORY"),
				course("c", 3, "THEORY"),
				course("d", 1.5, "PRACTICAL"),
			],
			{ ...rates, registrationFee: 0, lateFee: 0 },
			false,
		);
		assert.equal(fees.theoryCredits, 9);
		assert.equal(fees.practicalCredits, 1.5);
		assert.equal(fees.totalCredits, 10.5);
		assert.equal(fees.theoryFee, 108000, "9 x 120 = 1080 BDT");
		assert.equal(fees.practicalFee, 24000, "1.5 x 160 = 240 BDT");
		assert.equal(fees.totalAmount, 132000, "1320 BDT");
	});

	test("registration fee and late fee are separate lines in the total", () => {
		const base = calculateFees(
			[course("a", 3, "THEORY"), course("b", 1.5, "PRACTICAL")],
			rates,
			false,
		);
		assert.equal(base.theoryFee, 36000);
		assert.equal(base.practicalFee, 24000);
		assert.equal(base.registrationFee, 50000);
		assert.equal(base.lateFee, 0);
		assert.equal(base.totalAmount, 110000);

		const late = calculateFees(
			[course("a", 3, "THEORY"), course("b", 1.5, "PRACTICAL")],
			rates,
			true,
		);
		assert.equal(late.lateFee, 20000);
		assert.equal(late.totalAmount, 130000);
	});

	test("theory only, practical only, and project/thesis courses", () => {
		assert.equal(
			calculateFees([course("a", 4, "THEORY")], rates, false).practicalFee,
			0,
		);
		const practical = calculateFees(
			[course("a", 2, "PRACTICAL")],
			rates,
			false,
		);
		assert.equal(practical.theoryFee, 0);
		assert.equal(practical.practicalFee, 32000);
		const thesis = calculateFees(
			[course("t", 6, "THESIS"), course("p", 3, "PROJECT")],
			rates,
			false,
		);
		assert.equal(thesis.otherCredits, 9);
		assert.equal(thesis.otherFee, 180000);
		assert.equal(thesis.theoryFee + thesis.practicalFee, 0);
	});

	test("fractional credits never produce floating point drift", () => {
		const courses = Array.from({ length: 10 }, (_, i) =>
			course(`c${i}`, 0.5, "PRACTICAL"),
		);
		const fees = calculateFees(
			courses,
			{ ...rates, registrationFee: 0 },
			false,
		);
		assert.equal(fees.practicalCredits, 5);
		assert.equal(fees.practicalFee, 80000);
		assert.ok(Number.isInteger(fees.totalAmount));
	});

	test("an odd paisa rate rounds each course to a whole paisa, and totals add up from the lines", () => {
		const fees = calculateFees(
			[course("a", 1.5, "THEORY"), course("b", 1.5, "THEORY")],
			{ ...rates, theoryRate: 12345, registrationFee: 0 },
			false,
		);
		const lineSum = fees.lines.reduce((s, l) => s + l.amount, 0);
		assert.equal(
			fees.theoryFee,
			lineSum,
			"no hidden rounding gap between lines and the invoice",
		);
		assert.ok(Number.isInteger(fees.theoryFee));
	});

	test("zero rates give a zero invoice", () => {
		const zero = calculateFees(
			[course("a", 3, "THEORY")],
			{
				theoryRate: 0,
				practicalRate: 0,
				otherRate: 0,
				registrationFee: 0,
				lateFee: 0,
			},
			true,
		);
		assert.equal(zero.totalAmount, 0);
	});

	test("changing the rates later does not change an already computed breakdown", () => {
		const first = calculateFees([course("a", 3, "THEORY")], rates, false);
		const snapshot = JSON.stringify(first);
		calculateFees(
			[course("a", 3, "THEORY")],
			{ ...rates, theoryRate: 99999 },
			false,
		);
		assert.equal(JSON.stringify(first), snapshot);
		assert.equal(
			first.theoryRate,
			12000,
			"the rate used is part of the breakdown",
		);
	});
});
