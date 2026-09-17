import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256 } from "./hash";

test("sha256 is deterministic for the same input", () => {
	assert.equal(sha256("refresh-token-value"), sha256("refresh-token-value"));
});

test("sha256 produces different digests for different inputs", () => {
	assert.notEqual(sha256("token-a"), sha256("token-b"));
});

test("sha256 returns a 64-character lowercase hex string", () => {
	const digest = sha256("anything");
	assert.match(digest, /^[0-9a-f]{64}$/);
});
