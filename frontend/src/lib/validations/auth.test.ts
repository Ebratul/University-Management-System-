import { describe, expect, it } from "vitest";

import { loginSchema, passwordSchema, registerSchema, toRegisterPayload } from "./auth";

const validRegister = {
  name: "Jane Doe",
  email: "jane@university.edu",
  password: "Str0ng!pass",
  confirmPassword: "Str0ng!pass",
  phone: "",
  dateOfBirth: "",
  departmentId: "11111111-1111-4111-8111-111111111111",
  admissionSemesterId: "22222222-2222-4222-8222-222222222222",
};

describe("password policy", () => {
  it("matches the backend rules: length, lower, upper, number and symbol", () => {
    expect(passwordSchema.safeParse("Str0ng!pass").success).toBe(true);
    expect(passwordSchema.safeParse("short1!A").success).toBe(true);
    expect(passwordSchema.safeParse("alllowercase1!").success).toBe(false);
    expect(passwordSchema.safeParse("NoDigits!here").success).toBe(false);
    expect(passwordSchema.safeParse("NoSymbol123").success).toBe(false);
    expect(passwordSchema.safeParse("Sh0rt!").success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts a complete form", () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true);
  });

  it("requires the two passwords to match", () => {
    const result = registerSchema.safeParse({ ...validRegister, confirmPassword: "different" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["confirmPassword"]);
  });

  it("drops empty optional fields from the request body", () => {
    const payload = toRegisterPayload(validRegister);
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("dateOfBirth");
    expect(payload).not.toHaveProperty("confirmPassword");
  });

  it("keeps optional fields that were filled in", () => {
    const payload = toRegisterPayload({ ...validRegister, phone: "01700000000", dateOfBirth: "2005-02-01" });
    expect(payload).toMatchObject({ phone: "01700000000", dateOfBirth: "2005-02-01" });
  });
});

describe("loginSchema", () => {
  it("needs a valid email and a non-empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});
