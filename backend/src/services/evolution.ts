import axios from "axios";
import { env } from "../config/env";
import { logger } from "../config/logger";

const client = axios.create({
  baseURL: env.evolutionApiUrl,
  headers: { apikey: env.evolutionApiKey },
  timeout: 15000,
});

export interface SendTextResult {
  success: boolean;
  evolutionMessageId?: string;
  errorMessage?: string;
}

function normalizeNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function sendTextMessage(phone: string, text: string): Promise<SendTextResult> {
  if (!env.evolutionApiUrl || !env.evolutionInstanceName) {
    return { success: false, errorMessage: "Evolution API nao configurada (EVOLUTION_API_URL / EVOLUTION_INSTANCE_NAME ausentes)" };
  }

  try {
    const response = await client.post(`/message/sendText/${env.evolutionInstanceName}`, {
      number: normalizeNumber(phone),
      text,
    });

    const evolutionMessageId = response.data?.key?.id ?? response.data?.id ?? undefined;
    return { success: true, evolutionMessageId };
  } catch (err) {
    const message = axios.isAxiosError(err) ? err.response?.data?.message ?? err.message : String(err);
    logger.error({ err, phone }, "Falha ao enviar mensagem via Evolution API");
    return { success: false, errorMessage: typeof message === "string" ? message : JSON.stringify(message) };
  }
}

export type EvolutionMediaType = "image" | "video" | "audio" | "document";

export function mediaTypeFromMimetype(mimetype: string): EvolutionMediaType {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "document";
}

export async function sendMediaMessage(
  phone: string,
  base64: string,
  mediatype: EvolutionMediaType,
  fileName: string,
  caption?: string
): Promise<SendTextResult> {
  if (!env.evolutionApiUrl || !env.evolutionInstanceName) {
    return { success: false, errorMessage: "Evolution API nao configurada (EVOLUTION_API_URL / EVOLUTION_INSTANCE_NAME ausentes)" };
  }

  try {
    const response = await client.post(`/message/sendMedia/${env.evolutionInstanceName}`, {
      number: normalizeNumber(phone),
      mediatype,
      fileName,
      caption,
      media: base64,
    });

    const evolutionMessageId = response.data?.key?.id ?? response.data?.id ?? undefined;
    return { success: true, evolutionMessageId };
  } catch (err) {
    const message = axios.isAxiosError(err) ? err.response?.data?.message ?? err.message : String(err);
    logger.error({ err, phone }, "Falha ao enviar midia via Evolution API");
    return { success: false, errorMessage: typeof message === "string" ? message : JSON.stringify(message) };
  }
}

export async function getBase64FromMediaMessage(
  messageId: string,
  remoteJid: string
): Promise<{ base64: string; mimetype: string } | null> {
  if (!env.evolutionApiUrl || !env.evolutionInstanceName) return null;
  try {
    const response = await client.post(`/chat/getBase64FromMediaMessage/${env.evolutionInstanceName}`, {
      message: { key: { id: messageId, remoteJid, fromMe: false } },
    });
    const base64 = response.data?.base64;
    if (!base64) return null;
    return { base64, mimetype: response.data?.mimetype ?? "application/octet-stream" };
  } catch (err) {
    logger.error({ err, messageId }, "Falha ao obter midia recebida via Evolution API");
    return null;
  }
}

export async function getConnectionState(): Promise<{ state: string } | null> {
  if (!env.evolutionApiUrl || !env.evolutionInstanceName) return null;
  try {
    const response = await client.get(`/instance/connectionState/${env.evolutionInstanceName}`);
    return { state: response.data?.instance?.state ?? response.data?.state ?? "unknown" };
  } catch (err) {
    logger.error({ err }, "Falha ao consultar status da conexao Evolution API");
    return { state: "error" };
  }
}

export async function getQrCode(): Promise<{ base64?: string; pairingCode?: string } | null> {
  if (!env.evolutionApiUrl || !env.evolutionInstanceName) return null;
  try {
    const response = await client.get(`/instance/connect/${env.evolutionInstanceName}`);
    return { base64: response.data?.base64, pairingCode: response.data?.pairingCode };
  } catch (err) {
    logger.error({ err }, "Falha ao obter QR code da Evolution API");
    return null;
  }
}
