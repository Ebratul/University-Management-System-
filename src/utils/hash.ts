import crypto from "node:crypto";

// Used to store refresh tokens as a lookup hash instead of plaintext.
export const sha256 = (value: string): string =>
	crypto.createHash("sha256").update(value).digest("hex");
