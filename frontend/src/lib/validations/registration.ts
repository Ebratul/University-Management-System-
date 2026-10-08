import { z } from "zod";

import { bdtToPaisa, paisaToBdt } from "@/lib/format";
import type { RegistrationSettingValues } from "@/types/entities";

/**
 * The admin form for a semester's registration fees, limits and windows.
 * Mirrors backend registration-setting.validation.ts. Form values are strings;
 * toSettingPayload converts them (taka -> integer paisa, local date-time -> ISO).
 */
const money = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, { error: "Enter an amount such as 120 or 120.50." });

const credits = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, { error: "Enter a number of credits such as 12 or 21.5." })
  .refine((value) => Number(value) <= 60, { error: "Credits cannot exceed 60." });

const dateTime = z.string();

export const registrationSettingSchema = z
  .object({
    theoryRate: money,
    practicalRate: money,
    otherRate: money,
    registrationFee: money,
    lateFee: money,
    minCredits: credits,
    maxCredits: credits,
    registrationStart: dateTime,
    registrationEnd: dateTime,
    lateEnabled: z.boolean(),
    lateStart: dateTime,
    lateEnd: dateTime,
    invoiceValidityHours: z
      .string()
      .trim()
      .regex(/^\d+$/, { error: "Enter a whole number of hours." })
      .refine((value) => Number(value) >= 1 && Number(value) <= 720, { error: "Between 1 and 720 hours." }),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (Number(v.maxCredits) < Number(v.minCredits)) {
      issue("maxCredits", "Maximum credits cannot be less than the minimum.");
    }
    if ((v.registrationStart === "") !== (v.registrationEnd === "")) {
      issue("registrationEnd", "Set both the start and the end of registration.");
    }
    if (v.registrationStart && v.registrationEnd && new Date(v.registrationEnd) <= new Date(v.registrationStart)) {
      issue("registrationEnd", "Registration must end after it starts.");
    }
    if (v.lateEnabled) {
      if (!v.lateStart || !v.lateEnd) {
        issue("lateStart", "Set the late registration start and end.");
      } else {
        if (new Date(v.lateEnd) <= new Date(v.lateStart)) issue("lateEnd", "Late registration must end after it starts.");
        if (v.registrationEnd && new Date(v.lateStart) < new Date(v.registrationEnd)) {
          issue("lateStart", "Late registration must start after regular registration ends.");
        }
      }
    }
  });

export type RegistrationSettingFormInput = z.infer<typeof registrationSettingSchema>;

/** "2026-10-10T09:00" (what a datetime-local input holds) -> ISO, or null when empty. */
export function localInputToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** ISO -> "2026-10-10T09:00" in the viewer's time zone, for a datetime-local input. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toSettingDefaults(s: RegistrationSettingValues): RegistrationSettingFormInput {
  return {
    theoryRate: paisaToBdt(s.theoryRate),
    practicalRate: paisaToBdt(s.practicalRate),
    otherRate: paisaToBdt(s.otherRate),
    registrationFee: paisaToBdt(s.registrationFee),
    lateFee: paisaToBdt(s.lateFee),
    minCredits: String(s.minCredits),
    maxCredits: String(s.maxCredits),
    registrationStart: isoToLocalInput(s.registrationStart),
    registrationEnd: isoToLocalInput(s.registrationEnd),
    lateEnabled: s.lateEnabled,
    lateStart: isoToLocalInput(s.lateStart),
    lateEnd: isoToLocalInput(s.lateEnd),
    invoiceValidityHours: String(s.invoiceValidityHours),
  };
}

export function toSettingPayload(v: RegistrationSettingFormInput): RegistrationSettingValues {
  return {
    theoryRate: bdtToPaisa(v.theoryRate),
    practicalRate: bdtToPaisa(v.practicalRate),
    otherRate: bdtToPaisa(v.otherRate),
    registrationFee: bdtToPaisa(v.registrationFee),
    lateFee: bdtToPaisa(v.lateFee),
    minCredits: Number(v.minCredits),
    maxCredits: Number(v.maxCredits),
    registrationStart: localInputToIso(v.registrationStart),
    registrationEnd: localInputToIso(v.registrationEnd),
    lateEnabled: v.lateEnabled,
    lateStart: v.lateEnabled ? localInputToIso(v.lateStart) : null,
    lateEnd: v.lateEnabled ? localInputToIso(v.lateEnd) : null,
    invoiceValidityHours: Number(v.invoiceValidityHours),
  };
}
