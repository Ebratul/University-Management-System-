import { describe, expect, it } from "vitest";

import {
  codeSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  resetPasswordSchema,
  toRegisterPayload,
  verifyEmailSchema,
} from "./auth";

const validRegister = {
  name: "Jane Doe",
  email: "jane@university.edu",
  password: "Str0ng!pass",
  confirmPassword: "Str0ng!pass",
  registrationNumber: "2024-CSE-001",
  picture: new File(["x"], "me.png", { type: "image/png" }),
  phone: "",
  dateOfBirth: "",
  departmentId: "11111111-1111-4111-8111-111111111111",
  semesterLevel: "3",
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

  it("requires a registration number in a safe format", () => {
    expect(registerSchema.safeParse({ ...validRegister, registrationNumber: "" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegister, registrationNumber: "ab" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegister, registrationNumber: "../etc" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegister, registrationNumber: "REG 12" }).success).toBe(false);
  });

  it("requires a student picture of an allowed type and size", () => {
    expect(registerSchema.safeParse({ ...validRegister, picture: null }).success).toBe(false);
    const pdf = new File(["x"], "me.pdf", { type: "application/pdf" });
    expect(registerSchema.safeParse({ ...validRegister, picture: pdf }).success).toBe(false);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    expect(registerSchema.safeParse({ ...validRegister, picture: big }).success).toBe(false);
    const webp = new File(["x"], "me.webp", { type: "image/webp" });
    expect(registerSchema.safeParse({ ...validRegister, picture: webp }).success).toBe(true);
  });

  it("drops empty optional fields from the request body", () => {
    const body = toRegisterPayload(validRegister);
    expect(body.has("phone")).toBe(false);
    expect(body.has("dateOfBirth")).toBe(false);
    expect(body.has("confirmPassword")).toBe(false);
    expect(body.get("registrationNumber")).toBe("2024-CSE-001");
    expect(body.get("picture")).toBeInstanceOf(File);
  });

  it("keeps optional fields that were filled in", () => {
    const body = toRegisterPayload({ ...validRegister, phone: "01700000000", dateOfBirth: "2005-02-01" });
    expect(body.get("phone")).toBe("01700000000");
    expect(body.get("dateOfBirth")).toBe("2005-02-01");
  });
});

describe("loginSchema", () => {
  it("needs a valid email and a non-empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("emailed code flows", () => {
  it("accepts exactly six digits", () => {
    expect(codeSchema.safeParse("012345").success).toBe(true);
    expect(codeSchema.safeParse(" 123456 ").success).toBe(true);
    for (const bad of ["", "12345", "1234567", "12345a", "12 456"]) {
      expect(codeSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("verify needs a valid email and code", () => {
    expect(verifyEmailSchema.safeParse({ email: "a@b.co", code: "123456" }).success).toBe(true);
    expect(verifyEmailSchema.safeParse({ email: "nope", code: "123456" }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({ email: "a@b.co", code: "12" }).success).toBe(false);
  });

  it("forgot password only needs an email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });

  it("reset enforces the password policy and matching confirmation", () => {
    const ok = { email: "a@b.co", code: "123456", newPassword: "Str0ng!pass", confirmPassword: "Str0ng!pass" };
    expect(resetPasswordSchema.safeParse(ok).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ ...ok, newPassword: "weak", confirmPassword: "weak" }).success).toBe(false);
    const mismatch = resetPasswordSchema.safeParse({ ...ok, confirmPassword: "Different1!" });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) expect(mismatch.error.issues[0].path).toEqual(["confirmPassword"]);
  });
});
