import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const EXTENSION_BY_MIMETYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

function extensionFor(mimetype: string, fallbackName?: string): string {
  if (EXTENSION_BY_MIMETYPE[mimetype]) return EXTENSION_BY_MIMETYPE[mimetype];
  const fromName = fallbackName?.split(".").pop();
  return fromName || "bin";
}

export function saveBase64ToUploads(base64: string, mimetype: string, fileName?: string): { relativeUrl: string; fileName: string } {
  const buffer = Buffer.from(base64, "base64");
  const ext = extensionFor(mimetype, fileName);
  const generatedName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, generatedName), buffer);
  return { relativeUrl: `/uploads/${generatedName}`, fileName: fileName ?? generatedName };
}

export function saveBufferToUploads(buffer: Buffer, mimetype: string, fileName?: string): { relativeUrl: string; fileName: string } {
  return saveBase64ToUploads(buffer.toString("base64"), mimetype, fileName);
}
