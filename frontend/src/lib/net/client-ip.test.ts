import { describe, expect, it } from "vitest";

import { clientIpFrom } from "./client-ip";

describe("clientIpFrom", () => {
  it("prefers x-real-ip set by the platform", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("uses the last x-forwarded-for entry, the one the platform appended", () => {
    // Earlier entries are supplied by the client and must not be trusted.
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "10.0.0.1, 198.51.100.8" }))).toBe("198.51.100.8");
  });

  it("returns null when no address is available", () => {
    expect(clientIpFrom(new Headers())).toBeNull();
  });
});
