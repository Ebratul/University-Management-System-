import { describe, expect, it } from "vitest";

import type { Result } from "@/types/entities";

import { gradePointAverage } from "./gpa";

function result(gradePoint: number, credits: number): Result {
  return {
    id: crypto.randomUUID(),
    grade: "A",
    gradePoint,
    enrollmentId: "e",
    publishedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    enrollment: {
      id: "e",
      status: "COMPLETED",
      student: { id: "s", studentId: "STU", name: "Test" },
      courseOffering: { id: "o", course: { id: "c", courseCode: "C", title: "T", credits } },
    },
  };
}

describe("gradePointAverage", () => {
  it("returns null when there are no results", () => {
    expect(gradePointAverage(undefined)).toBeNull();
    expect(gradePointAverage([])).toBeNull();
  });

  it("weights each grade point by its course's credits", () => {
    // (4.0 x 3 + 2.0 x 1) / 4 = 3.5
    expect(gradePointAverage([result(4, 3), result(2, 1)])).toBeCloseTo(3.5);
  });
});
