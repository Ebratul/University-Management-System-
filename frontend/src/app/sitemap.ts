import type { MetadataRoute } from "next";

import { getAllCourses, getAllDepartments } from "@/lib/api/public-data";
import { publicEnv } from "@/lib/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const [departments, courses] = await Promise.all([
    getAllDepartments().catch(() => []),
    getAllCourses().catch(() => []),
  ]);

  const staticRoutes = ["", "/courses", "/departments", "/faculties", "/notices"];

  return [
    ...staticRoutes.map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.7 })),
    ...departments.map((department) => ({ url: `${base}/departments/${department.id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...courses.map((course) => ({ url: `${base}/courses/${course.id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
