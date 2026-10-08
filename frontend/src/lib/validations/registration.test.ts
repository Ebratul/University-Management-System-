import { describe, expect, it } from "vitest";

import { bdtToPaisa, formatPaisa, paisaToBdt } from "@/lib/format";
import {
  isoToLocalInput,
  localInputToIso,
  registrationSettingSchema,
  toSettingDefaults,
  toSettingPayload,
  type RegistrationSettingFormInput,
} from "./registration";

const valid: RegistrationSettingFormInput = {
  theoryRate: "120",
  practicalRate: "160.50",
  otherRate: "200",
  registrationFee: "500",
  lateFee: "200",
  minCredits: "12",
  maxCredits: "21",
  registrationStart: "2026-10-10T09:00",
  registrationEnd: "2026-10-20T17:00",
  lateEnabled: true,
  lateStart: "2026-10-21T09:00",
  lateEnd: "2026-10-25T17:00",
  invoiceValidityHours: "72",
};

describe("money conversion never touches floating point", () => {
  it("converts taka text to exact integer paisa and back", () => {
    expect(bdtToPaisa("120")).toBe(12000);
    expect(bdtToPaisa("120.5")).toBe(12050);
    expect(bdtToPaisa("160.50")).toBe(16050);
    expect(bdtToPaisa("0.07")).toBe(7);
    expect(bdtToPaisa("1234567.89")).toBe(123456789);
    expect(paisaToBdt(12050)).toBe("120.50");
    expect(paisaToBdt(7)).toBe("0.07");
    expect(paisaToBdt(0)).toBe("0.00");
  });

  it("formats paisa as taka", () => {
    expect(formatPaisa(132000)).toBe("৳1,320.00");
    expect(formatPaisa(0)).toBe("৳0.00");
    expect(formatPaisa(12050)).toBe("৳120.50");
    expect(formatPaisa(123456789)).toBe("৳1,234,567.89");
  });
});

describe("registration settings form", () => {
  it("accepts a complete configuration", () => {
    expect(registrationSettingSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects bad amounts and credit limits", () => {
    expect(registrationSettingSchema.safeParse({ ...valid, theoryRate: "-1" }).success).toBe(false);
    expect(registrationSettingSchema.safeParse({ ...valid, theoryRate: "1.234" }).success).toBe(false);
    expect(registrationSettingSchema.safeParse({ ...valid, theoryRate: "abc" }).success).toBe(false);
    expect(registrationSettingSchema.safeParse({ ...valid, minCredits: "22", maxCredits: "21" }).success).toBe(false);
    expect(registrationSettingSchema.safeParse({ ...valid, maxCredits: "61" }).success).toBe(false);
  });

  it("validates the windows", () => {
    const r = (patch: Partial<RegistrationSettingFormInput>) => registrationSettingSchema.safeParse({ ...valid, ...patch });
    expect(r({ registrationEnd: "2026-10-09T09:00" }).success).toBe(false); // ends before it starts
    expect(r({ registrationEnd: "" }).success).toBe(false); // only one end set
    expect(r({ lateStart: "2026-10-19T09:00" }).success).toBe(false); // late starts before regular ends
    expect(r({ lateEnd: "2026-10-20T09:00" }).success).toBe(false); // late ends before it starts
    expect(r({ lateEnabled: true, lateStart: "", lateEnd: "" }).success).toBe(false);
    expect(r({ lateEnabled: false, lateStart: "", lateEnd: "" }).success).toBe(true);
    expect(r({ invoiceValidityHours: "0" }).success).toBe(false);
  });

  it("converts the form into the exact payload the API expects (integer paisa)", () => {
    const payload = toSettingPayload(valid);
    expect(payload.theoryRate).toBe(12000);
    expect(payload.practicalRate).toBe(16050);
    expect(payload.registrationFee).toBe(50000);
    expect(payload.minCredits).toBe(12);
    expect(payload.invoiceValidityHours).toBe(72);
    expect(payload.registrationStart).toBe(new Date("2026-10-10T09:00").toISOString());
    expect(Number.isInteger(payload.theoryRate)).toBe(true);
  });

  it("drops the late window when late registration is off", () => {
    const payload = toSettingPayload({ ...valid, lateEnabled: false });
    expect(payload.lateStart).toBeNull();
    expect(payload.lateEnd).toBeNull();
  });

  it("round-trips: defaults built from a saved setting convert back to the same payload", () => {
    const payload = toSettingPayload(valid);
    expect(toSettingPayload(toSettingDefaults(payload))).toEqual(payload);
  });

  it("converts local date-times both ways", () => {
    expect(localInputToIso("")).toBeNull();
    expect(isoToLocalInput(null)).toBe("");
    const iso = localInputToIso("2026-10-10T09:30") as string;
    expect(isoToLocalInput(iso)).toBe("2026-10-10T09:30");
  });
});
