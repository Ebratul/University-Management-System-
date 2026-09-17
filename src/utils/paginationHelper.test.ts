import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMeta, calculatePagination } from "./paginationHelper";

test("calculatePagination defaults to page 1, limit 10, sortBy createdAt desc", () => {
	const result = calculatePagination({});
	assert.equal(result.page, 1);
	assert.equal(result.limit, 10);
	assert.equal(result.skip, 0);
	assert.equal(result.sortBy, "createdAt");
	assert.equal(result.sortOrder, "desc");
});

test("calculatePagination computes skip from page and limit", () => {
	const result = calculatePagination({ page: "3", limit: "20" });
	assert.equal(result.skip, 40);
});

test("calculatePagination clamps limit to 100 and page to at least 1", () => {
	assert.equal(calculatePagination({ limit: "9999" }).limit, 100);
	assert.equal(calculatePagination({ page: "-5" }).page, 1);
});

test("calculatePagination treats limit=0 as unset (falls back to the default)", () => {
	// `Number(query.limit) || 10` treats 0 as falsy, same as an empty/missing value.
	assert.equal(calculatePagination({ limit: "0" }).limit, 10);
});

test("calculatePagination only accepts sortBy from the allowed list", () => {
	const allowed = ["name", "code"];
	assert.equal(calculatePagination({ sortBy: "name" }, allowed).sortBy, "name");
	assert.equal(
		calculatePagination({ sortBy: "password" }, allowed).sortBy,
		"name",
	);
});

test("calculatePagination treats sortOrder other than asc as desc", () => {
	assert.equal(calculatePagination({ sortOrder: "asc" }).sortOrder, "asc");
	assert.equal(calculatePagination({ sortOrder: "banana" }).sortOrder, "desc");
});

test("buildMeta computes totalPages via ceiling division", () => {
	assert.deepEqual(buildMeta(25, 1, 10), {
		page: 1,
		limit: 10,
		total: 25,
		totalPages: 3,
	});
	assert.deepEqual(buildMeta(0, 1, 10), {
		page: 1,
		limit: 10,
		total: 0,
		totalPages: 0,
	});
});
