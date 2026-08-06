import crypto from "node:crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = Buffer.from(env.encryptionKey, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY deve ser uma string hex de 32 bytes (64 caracteres). Gere com: openssl rand -hex 32");
  }
  return key;
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Payload criptografado invalido");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

export function maskSecret(plainText: string): string {
  if (plainText.length <= 8) return "****";
  return `${plainText.slice(0, 4)}${"*".repeat(8)}${plainText.slice(-4)}`;
}
