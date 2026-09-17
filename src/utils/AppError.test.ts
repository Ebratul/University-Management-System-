import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "./AppError";

test("AppError carries statusCode, message, and is a real Error", () => {
	const error = new AppError(404, "Not found");
	assert.ok(error instanceof Error);
	assert.equal(error.statusCode, 404);
	assert.equal(error.message, "Not found");
	assert.equal(error.errors, undefined);
});

test("AppError carries optional field-level errors", () => {
	const errors = [{ path: "email", message: "Invalid email address." }];
	const error = new AppError(400, "Validation failed", errors);
	assert.deepEqual(error.errors, errors);
});

test("AppError has a stack trace", () => {
	const error = new AppError(500, "boom");
	assert.ok(typeof error.stack === "string" && error.stack.length > 0);
});
