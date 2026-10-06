import "server-only";

import type {
  Course,
  CourseOffering,
  Department,
  Faculty,
  Notice,
  WebsiteSettings,
} from "@/types/entities";
import { DEFAULT_WEBSITE_SETTINGS, WEBSITE_SETTINGS_TAG } from "@/lib/website-settings";

import { fetchAllPages, fetchOne, serverRequest } from "./server";

/**
 * Data for the public, statically generated pages. Every read here is
 * anonymous, so the API returns only public rows (for example, notices with
 * audience ALL). Each read sets an ISR interval, so pages are built once and
 * then refreshed in the background.
 */
export const PUBLIC_REVALIDATE = 300;
const FAST_REVALIDATE = 60;

export const getAllDepartments = () =>
  fetchAllPages<Department>("/departments", {
    revalidate: PUBLIC_REVALIDATE,
    query: { sortBy: "name", sortOrder: "asc" },
  });

export const getDepartment = (id: string) =>
  fetchOne<Department>(`/departments/${id}`, { revalidate: PUBLIC_REVALIDATE });

export const getAllCourses = () =>
  fetchAllPages<Course>("/courses", {
    revalidate: PUBLIC_REVALIDATE,
    query: { sortBy: "courseCode", sortOrder: "asc" },
  });

export const getCoursesByDepartment = (departmentId: string) =>
  fetchAllPages<Course>("/courses", {
    revalidate: PUBLIC_REVALIDATE,
    query: { departmentId, sortBy: "courseCode", sortOrder: "asc" },
  });

export const getCourse = (id: string) =>
  fetchOne<Course>(`/courses/${id}`, { revalidate: PUBLIC_REVALIDATE });

export const getCourseOfferings = (courseId: string) =>
  fetchAllPages<CourseOffering>("/course-offerings", {
    revalidate: FAST_REVALIDATE,
    query: { courseId },
  });

export const getAllFaculties = () =>
  fetchAllPages<Faculty>("/faculties", {
    revalidate: PUBLIC_REVALIDATE,
    query: { sortBy: "name", sortOrder: "asc" },
  });

export const getAllNotices = () =>
  fetchAllPages<Notice>("/notices", {
    revalidate: FAST_REVALIDATE,
    query: { sortBy: "createdAt", sortOrder: "desc" },
  });

export const getNotice = (id: string) =>
  fetchOne<Notice>(`/notices/${id}`, { revalidate: FAST_REVALIDATE });

/** Newest few notices for the landing page. */
export async function getLatestNotices(count = 3): Promise<Notice[]> {
  const envelope = await serverRequest<Notice[]>("/notices", {
    revalidate: FAST_REVALIDATE,
    query: { limit: count, sortBy: "createdAt", sortOrder: "desc" },
  });
  return envelope.data;
}

/**
 * Public branding. Never throws: if the API is down the site falls back to
 * the defaults. Tagged so an admin save can refresh it immediately.
 */
export async function getWebsiteSettings(): Promise<WebsiteSettings> {
  try {
    const envelope = await serverRequest<WebsiteSettings>("/website-settings", {
      revalidate: PUBLIC_REVALIDATE,
      tags: [WEBSITE_SETTINGS_TAG],
    });
    return envelope.data;
  } catch {
    return DEFAULT_WEBSITE_SETTINGS;
  }
}
