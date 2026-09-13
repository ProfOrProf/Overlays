import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const nameKey = (token) => createHash("sha256").update("lorelibrary room name\0" + token, "utf8").digest();

export const verifierOf = (token) => createHash("sha256").update(token, "utf8").digest("hex");

export function sealName(token, name) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", nameKey(token), iv);
  const body = Buffer.concat([c.update(name, "utf8"), c.final()]);
  return Buffer.concat([iv, body, c.getAuthTag()]).toString("base64");
}

export function openName(token, sealed) {
  try {
    const b = Buffer.from(sealed, "base64");
    const d = createDecipheriv("aes-256-gcm", nameKey(token), b.subarray(0, 12));
    d.setAuthTag(b.subarray(b.length - 16));
    return Buffer.concat([d.update(b.subarray(12, b.length - 16)), d.final()]).toString("utf8");
  } catch {
    return undefined;
  }
}
