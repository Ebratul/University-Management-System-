import { describe, expect, it } from "vitest";

import { GRADE_POINTS, resultSchema, semesterSchema } from "./admin";

const backendGradePattern = /^[A-F][+-]?$/;

describe("GRADE_POINTS", () => {
  it("only offers grades the backend accepts", () => {
    for (const grade of Object.keys(GRADE_POINTS)) {
      expect(grade).toMatch(backendGradePattern);
    }
  });

  it("keeps every grade point inside the backend's 0 to 5 range", () => {
    for (const point of Object.values(GRADE_POINTS)) {
      expect(point).toBeGreaterThanOrEqual(0);
      expect(point).toBeLessThanOrEqual(5);
    }
  });
});

describe("resultSchema", () => {
  it("accepts a grade with a point inside the range", () => {
    expect(resultSchema.safeParse({ grade: "A-", gradePoint: "3.7" }).success).toBe(true);
  });

  it("rejects a point above 5 or below 0", () => {
    expect(resultSchema.safeParse({ grade: "A", gradePoint: "6" }).success).toBe(false);
    expect(resultSchema.safeParse({ grade: "A", gradePoint: "-1" }).success).toBe(false);
  });
});

describe("semesterSchema", () => {
  const base = { year: "2027", code: "FALL", startDate: "2027-09-01", endDate: "2027-12-31", status: "UPCOMING" as const, feeAmount: "5500" };

  it("requires the end date to come after the start date", () => {
    expect(semesterSchema.safeParse(base).success).toBe(true);
    expect(semesterSchema.safeParse({ ...base, endDate: "2027-08-01" }).success).toBe(false);
  });

  it("limits the fee to two decimal places", () => {
    expect(semesterSchema.safeParse({ ...base, feeAmount: "5500.50" }).success).toBe(true);
    expect(semesterSchema.safeParse({ ...base, feeAmount: "5500.555" }).success).toBe(false);
  });
});
