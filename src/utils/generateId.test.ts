import assert from "node:assert/strict";
import { test } from "node:test";
import { generateSequenceId } from "./generateId";

test("generateSequenceId includes the prefix and year", () => {
	const id = generateSequenceId("STU", 2026);
	assert.match(id, /^STU-2026-\d{6}$/);
});

test("generateSequenceId is not the same value on every call", () => {
	const ids = new Set(
		Array.from({ length: 20 }, () => generateSequenceId("FAC", 2026)),
	);
	assert.ok(ids.size > 1, "expected randomness across repeated calls");
});
