import { z } from "zod";

/**
 * Mirrors backend/src/module/auth/auth.validation.ts. If a rule changes on the
 * server, change it here too, so the form fails before a request is sent.
 */
export const passwordSchema = z
  .string()
  .min(8, { error: "Password must be at least 8 characters." })
  .regex(/[a-z]/, { error: "Include at least one lowercase letter." })
  .regex(/[A-Z]/, { error: "Include at least one uppercase letter." })
  .regex(/[0-9]/, { error: "Include at least one number." })
  .regex(/[^A-Za-z0-9]/, { error: "Include at least one special character." });

export const loginSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }),
  password: z.string().min(1, { error: "Password is required." }),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Student picture limits. Mirror the backend (JPG/PNG/WebP, 5 MB). */
export const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

const pictureSchema = z
  .custom<File | null>((value) => value instanceof File, { error: "Add your student picture." })
  .refine((file) => !file || PICTURE_TYPES.includes(file.type), {
    error: "The picture must be a JPG, PNG or WebP image.",
  })
  .refine((file) => !file || file.size <= MAX_PICTURE_BYTES, {
    error: "The picture must be 5 MB or smaller.",
  });

const registerBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { error: "Name must be at least 3 characters." })
    .max(100, { error: "Name must be at most 100 characters." }),
  email: z.email({ error: "Enter a valid email address." }),
  password: passwordSchema,
  confirmPassword: z.string(),
  registrationNumber: z
    .string()
    .trim()
    .min(3, { error: "Registration number must be at least 3 characters." })
    .max(30, { error: "Registration number must be at most 30 characters." })
    .regex(/^[A-Za-z0-9][A-Za-z0-9\-_/.]*$/, {
      error: "Use letters, numbers, - _ / and . only.",
    }),
  picture: pictureSchema,
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || (value.length >= 6 && value.length <= 20), {
      error: "Phone must be 6 to 20 characters.",
    }),
  dateOfBirth: z
    .string()
    .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), {
      error: "Enter a valid date.",
    }),
  departmentId: z.uuid({ error: "Choose your department." }),
  /** Academic semester 1-8, as text because it comes from a select. */
  semesterLevel: z
    .string()
    .regex(/^[1-8]$/, { error: "Select your semester." }),
});

export const registerSchema = registerBaseSchema.refine(
  (data) => data.password === data.confirmPassword,
  { error: "Passwords do not match.", path: ["confirmPassword"] },
);

export type RegisterFormInput = z.infer<typeof registerSchema>;

/** Builds the multipart body the API expects (empty optionals are omitted). */
export function toRegisterPayload(values: RegisterFormInput) {
  const body = new FormData();
  body.append("name", values.name);
  body.append("email", values.email);
  body.append("password", values.password);
  body.append("registrationNumber", values.registrationNumber);
  body.append("departmentId", values.departmentId);
  body.append("semesterLevel", values.semesterLevel);
  if (values.phone) body.append("phone", values.phone);
  if (values.dateOfBirth) body.append("dateOfBirth", values.dateOfBirth);
  if (values.picture) body.append("picture", values.picture);
  return body;
}

/** The 6-digit code from the verification / reset email. */
export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { error: "Enter the 6-digit code from your email." });

export const verifyEmailSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }),
  code: codeSchema,
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    email: z.email({ error: "Enter a valid email address." }),
    code: codeSchema,
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** The marker the API puts on the 403 for a correct password on an unverified account. */
export const EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";
