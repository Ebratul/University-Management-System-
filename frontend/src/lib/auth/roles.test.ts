import { describe, expect, it } from "vitest";

import { DEMO_ROLE_SEGMENT, homeForRole, safeInternalPath } from "./roles";

describe("safeInternalPath", () => {
  it("keeps same-site relative paths, including their query string", () => {
    expect(safeInternalPath("/admin/students?page=2")).toBe("/admin/students?page=2");
  });

  it("rejects absolute and protocol-relative URLs so ?next= cannot leave the site", () => {
    expect(safeInternalPath("https://evil.example")).toBeNull();
    expect(safeInternalPath("//evil.example")).toBeNull();
    expect(safeInternalPath("/\\evil.example")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath("")).toBeNull();
  });
});

describe("role routing", () => {
  it("sends each role to its own home", () => {
    expect(homeForRole("ADMIN")).toBe("/admin");
    expect(homeForRole("FACULTY")).toBe("/faculty");
    expect(homeForRole("STUDENT")).toBe("/student");
  });

  it("maps the three demo URL segments to the three roles", () => {
    expect(DEMO_ROLE_SEGMENT).toEqual({ admin: "ADMIN", faculty: "FACULTY", student: "STUDENT" });
  });
});
