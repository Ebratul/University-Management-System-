import { describe, expect, it } from "vitest";

import { isAccessTokenFresh } from "./token";

/** Builds an unsigned JWT-shaped string. The proxy only reads `exp`, never the signature. */
function tokenWithExp(exp: number | undefined) {
  const payload = Buffer.from(JSON.stringify(exp === undefined ? {} : { exp })).toString("base64url");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
}

describe("isAccessTokenFresh", () => {
  it("accepts a token that expires well in the future", () => {
    expect(isAccessTokenFresh(tokenWithExp(Math.floor(Date.now() / 1000) + 600))).toBe(true);
  });

  it("rejects an expired token", () => {
    expect(isAccessTokenFresh(tokenWithExp(1))).toBe(false);
  });

  it("rejects a token that expires inside the 30 second safety window", () => {
    expect(isAccessTokenFresh(tokenWithExp(Math.floor(Date.now() / 1000) + 10))).toBe(false);
  });

  it("rejects tokens without an exp claim or with a malformed payload", () => {
    expect(isAccessTokenFresh(tokenWithExp(undefined))).toBe(false);
    expect(isAccessTokenFresh("not-a-jwt")).toBe(false);
    expect(isAccessTokenFresh("a.%%%.c")).toBe(false);
  });
});
