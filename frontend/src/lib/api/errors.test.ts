import { describe, expect, it } from "vitest";

import { ApiError, toApiError } from "./errors";

describe("toApiError", () => {
  it("passes an ApiError through unchanged", () => {
    const error = new ApiError("nope", 403);
    expect(toApiError(error)).toBe(error);
  });

  it("reads the message, status and field errors from a failed response", () => {
    const failure = Object.assign(new Error("fetch failed"), {
      statusCode: 400,
      data: { message: "Validation failed", errors: [{ path: "email", message: "Invalid email address." }] },
    });

    const mapped = toApiError(failure);
    expect(mapped.message).toBe("Validation failed");
    expect(mapped.status).toBe(400);
    expect(mapped.errors).toEqual([{ path: "email", message: "Invalid email address." }]);
  });

  it("says so plainly when the server never answers (timeout)", () => {
    const timeout = Object.assign(new Error("[POST] /ai/quiz/generate: <no response> The operation was aborted due to timeout"), {
      statusCode: undefined,
      data: undefined,
    });
    const mapped = toApiError(timeout);
    expect(mapped.status).toBe(504);
    expect(mapped.message).toMatch(/did not answer in time/);
  });

  it("keeps the generic message for an error response that has no readable body", () => {
    const bare = Object.assign(new Error("Bad Gateway"), { statusCode: 502, data: undefined });
    expect(toApiError(bare).message).toBe("The request could not be completed.");
  });

  it("reports a network failure as status 0", () => {
    expect(toApiError(new TypeError("Failed to fetch")).status).toBe(0);
  });

  it("falls back to a generic message for anything else", () => {
    const mapped = toApiError("boom");
    expect(mapped.status).toBe(500);
    expect(mapped.message).toMatch(/Something went wrong/);
  });
});
