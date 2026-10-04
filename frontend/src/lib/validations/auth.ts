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

const registerBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { error: "Name must be at least 3 characters." })
    .max(100, { error: "Name must be at most 100 characters." }),
  email: z.email({ error: "Enter a valid email address." }),
  password: passwordSchema,
  confirmPassword: z.string(),
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
  admissionSemesterId: z.uuid({ error: "Choose your admission semester." }),
});

export const registerSchema = registerBaseSchema.refine(
  (data) => data.password === data.confirmPassword,
  { error: "Passwords do not match.", path: ["confirmPassword"] },
);

export type RegisterFormInput = z.infer<typeof registerSchema>;

/** Converts form values into the body the API expects (empty optionals are omitted). */
export function toRegisterPayload(values: RegisterFormInput) {
  return {
    name: values.name,
    email: values.email,
    password: values.password,
    departmentId: values.departmentId,
    admissionSemesterId: values.admissionSemesterId,
    ...(values.phone ? { phone: values.phone } : {}),
    ...(values.dateOfBirth ? { dateOfBirth: values.dateOfBirth } : {}),
  };
}
