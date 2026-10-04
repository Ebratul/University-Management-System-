import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest, refreshSession } from "./client";

/** A tiny in-memory API: /users/me needs a valid session, and refresh restores it. */
function fakeApi(options: { refreshWorks: boolean }) {
  const calls: string[] = [];
  let session = false;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);

    if (url.endsWith("/auth/refresh-token")) {
      // Hold the refresh open so that concurrent requests queue behind it.
      await new Promise((resolve) => setTimeout(resolve, 20));
      session = options.refreshWorks;
      return session ? json(200, { success: true, statusCode: 200, message: "ok", data: {} }) : json(401, { success: false, statusCode: 401, message: "expired" });
    }

    if (url.endsWith("/users/me")) {
      return session
        ? json(200, { success: true, statusCode: 200, message: "ok", data: { id: "u1" } })
        : json(401, { success: false, statusCode: 401, message: "Not logged in" });
    }

    return json(404, { success: false, statusCode: 404, message: "missing" });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser API client", () => {
  it("refreshes once and retries when five requests hit 401 together", async () => {
    const { calls } = fakeApi({ refreshWorks: true });

    const results = await Promise.all(Array.from({ length: 5 }, () => apiRequest<{ id: string }>("/users/me")));

    expect(results.every((user) => user.id === "u1")).toBe(true);
    expect(calls.filter((call) => call.includes("/auth/refresh-token"))).toHaveLength(1);
  });

  it("surfaces the original 401 when the refresh is rejected, without looping", async () => {
    const { calls } = fakeApi({ refreshWorks: false });

    await expect(apiRequest("/users/me")).rejects.toMatchObject({ status: 401 });
    expect(calls.filter((call) => call.includes("/auth/refresh-token"))).toHaveLength(1);
    expect(await refreshSession()).toBe(false);
  });
});
