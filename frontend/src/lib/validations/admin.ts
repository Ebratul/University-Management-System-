import { z } from "zod";

import { passwordSchema } from "@/lib/validations/auth";

/**
 * Admin form rules, mirroring the backend *.validation.ts files. Form values
 * are strings (inputs are text), and the payload helpers convert them.
 */
const requiredText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, { error: `${label} must be at least ${min} characters.` })
    .max(max, { error: `${label} must be at most ${max} characters.` });

const optionalText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || (value.length >= min && value.length <= max), {
      error: `${label} must be ${min} to ${max} characters.`,
    });

const wholeNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, { error: `${label} must be a whole number.` })
    .refine((value) => Number(value) >= min && Number(value) <= max, {
      error: `${label} must be between ${min} and ${max}.`,
    });

const money = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, { error: "Enter an amount such as 5500 or 5500.50." });

const requiredChoice = (label: string) => z.string().min(1, { error: `Choose a ${label}.` });

const phone = optionalText(6, 20, "Phone");
const designation = optionalText(2, 100, "Designation");

export const departmentSchema = z.object({
  name: requiredText(2, 150, "Name"),
  code: requiredText(2, 20, "Code"),
});

export const semesterSchema = z
  .object({
    year: wholeNumber(2000, 2100, "Year"),
    code: requiredText(3, 30, "Code"),
    startDate: requiredChoice("start date"),
    endDate: requiredChoice("end date"),
    status: z.enum(["UPCOMING", "ONGOING", "COMPLETED"]),
    feeAmount: money,
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate > data.startDate, {
    error: "End date must be after the start date.",
    path: ["endDate"],
  });

export const courseSchema = z.object({
  courseCode: requiredText(2, 20, "Course code"),
  title: requiredText(2, 150, "Title"),
  credits: wholeNumber(1, 10, "Credits"),
  departmentId: requiredChoice("department"),
});

export const facultyCreateSchema = z.object({
  name: requiredText(3, 100, "Name"),
  email: z.email({ error: "Enter a valid email address." }),
  password: passwordSchema,
  phone,
  designation,
  departmentId: requiredChoice("department"),
});

export const facultyUpdateSchema = z.object({
  name: requiredText(3, 100, "Name"),
  phone,
  designation,
  departmentId: requiredChoice("department"),
});

export const offeringCreateSchema = z.object({
  courseId: requiredChoice("course"),
  facultyId: requiredChoice("faculty member"),
  semesterId: requiredChoice("semester"),
  maxSeats: z.string().trim().refine((value) => value === "" || /^\d+$/.test(value), {
    error: "Seats must be a whole number.",
  }),
});

export const offeringUpdateSchema = z.object({
  maxSeats: wholeNumber(1, 500, "Seats"),
  facultyId: requiredChoice("faculty member"),
});

export const adminUserSchema = z.object({
  name: requiredText(3, 100, "Name"),
  email: z.email({ error: "Enter a valid email address." }),
  password: passwordSchema,
  phone,
});

export const studentUpdateSchema = z.object({
  name: requiredText(3, 100, "Name"),
  phone,
  dateOfBirth: z.string(),
  departmentId: requiredChoice("department"),
});

export const noticeSchema = z.object({
  title: requiredText(3, 200, "Title"),
  content: requiredText(1, 5000, "Content"),
  audience: z.enum(["ALL", "STUDENT", "FACULTY"]),
});

/** Converts an optional string field to undefined when empty, so it is omitted from the body. */
export const emptyToUndefined = (value: string | undefined) => (value && value.trim() !== "" ? value.trim() : undefined);

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type SemesterInput = z.infer<typeof semesterSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type FacultyCreateInput = z.infer<typeof facultyCreateSchema>;
export type FacultyUpdateInput = z.infer<typeof facultyUpdateSchema>;
export type OfferingCreateInput = z.infer<typeof offeringCreateSchema>;
export type OfferingUpdateInput = z.infer<typeof offeringUpdateSchema>;
export type AdminUserInput = z.infer<typeof adminUserSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
export type NoticeInput = z.infer<typeof noticeSchema>;

/** Grade letters and the grade point each one maps to. Faculty can still override the point. */
export const GRADE_POINTS: Record<string, number> = {
  "A+": 4,
  A: 4,
  "A-": 3.7,
  "B+": 3.3,
  B: 3,
  "B-": 2.7,
  "C+": 2.3,
  C: 2,
  "C-": 1.7,
  "D+": 1.3,
  D: 1,
  F: 0,
};

export const resultSchema = z.object({
  grade: z.string().min(1, { error: "Choose a grade." }),
  gradePoint: z
    .string()
    .trim()
    .regex(/^\d(\.\d{1,2})?$/, { error: "Enter a grade point from 0 to 5, such as 3.7." })
    .refine((value) => Number(value) >= 0 && Number(value) <= 5, { error: "Grade point must be between 0 and 5." }),
});

export type ResultInput = z.infer<typeof resultSchema>;
