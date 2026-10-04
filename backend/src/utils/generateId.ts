import crypto from "node:crypto";

// e.g. generateSequenceId("STU", 2026) -> "STU-2026-482913"
export const generateSequenceId = (prefix: string, year: number): string =>
	`${prefix}-${year}-${crypto.randomInt(100000, 999999)}`;
