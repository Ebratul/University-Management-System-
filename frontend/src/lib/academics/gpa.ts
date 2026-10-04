import type { Result } from "@/types/entities";

/** Credit-weighted GPA over published results. Returns null when there is nothing to average. */
export function gradePointAverage(results: Result[] | undefined): number | null {
  if (!results || results.length === 0) return null;

  const credits = results.reduce((sum, r) => sum + r.enrollment.courseOffering.course.credits, 0);
  if (credits === 0) return null;

  const weighted = results.reduce((sum, r) => sum + r.gradePoint * r.enrollment.courseOffering.course.credits, 0);
  return weighted / credits;
}
