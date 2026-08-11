import axios, { AxiosInstance } from "axios";
import { logger } from "../config/logger";
import { InstanceCredentials } from "./whatsappInstances";

const clientCache = new Map<string, AxiosInstance>();

function clientFor(instance: InstanceCredentials): AxiosInstance {
  const cacheKey = `${instance.apiUrl}::${instance.apiKey}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const client = axios.create({
    baseURL: instance.apiUrl,
    headers: { apikey: instance.apiKey },
    timeout: 15000,
  });
  clientCache.set(cacheKey, client);
  return client;
}

export interface SendTextResult {
  success: boolean;
  evolutionMessageId?: string;
  errorMessage?: string;
}

function normalizeNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function sendTextMessage(instance: InstanceCredentials, phone: string, text: string): Promise<SendTextResult> {
  try {
    const response = await clientFor(instance).post(`/message/sendText/${instance.instanceName}`, {
      number: normalizeNumber(phone),
      text,
    });

    const evolutionMessageId = response.data?.key?.id ?? response.data?.id ?? undefined;
    return { success: true, evolutionMessageId };
  } catch (err) {
    const message = axios.isAxiosError(err) ? err.response?.data?.message ?? err.message : String(err);
    logger.error({ err, phone, instance: instance.instanceName }, "Falha ao enviar mensagem via Evolution API");
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
  instance: InstanceCredentials,
  phone: string,
  base64: string,
  mediatype: EvolutionMediaType,
  fileName: string,
  caption?: string
): Promise<SendTextResult> {
  try {
    const response = await clientFor(instance).post(`/message/sendMedia/${instance.instanceName}`, {
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
    logger.error({ err, phone, instance: instance.instanceName }, "Falha ao enviar midia via Evolution API");
    return { success: false, errorMessage: typeof message === "string" ? message : JSON.stringify(message) };
  }
}

export async function getBase64FromMediaMessage(
  instance: InstanceCredentials,
  messageId: string,
  remoteJid: string
): Promise<{ base64: string; mimetype: string } | null> {
  try {
    const response = await clientFor(instance).post(`/chat/getBase64FromMediaMessage/${instance.instanceName}`, {
      message: { key: { id: messageId, remoteJid, fromMe: false } },
    });
    const base64 = response.data?.base64;
    if (!base64) return null;
    return { base64, mimetype: response.data?.mimetype ?? "application/octet-stream" };
  } catch (err) {
    logger.error({ err, messageId, instance: instance.instanceName }, "Falha ao obter midia recebida via Evolution API");
    return null;
  }
}

export async function getConnectionState(instance: InstanceCredentials): Promise<{ state: string } | null> {
  try {
    const response = await clientFor(instance).get(`/instance/connectionState/${instance.instanceName}`);
    return { state: response.data?.instance?.state ?? response.data?.state ?? "unknown" };
  } catch (err) {
    logger.error({ err, instance: instance.instanceName }, "Falha ao consultar status da conexao Evolution API");
    return { state: "error" };
  }
}

export async function getQrCode(instance: InstanceCredentials): Promise<{ base64?: string; pairingCode?: string } | null> {
  try {
    const response = await clientFor(instance).get(`/instance/connect/${instance.instanceName}`);
    return { base64: response.data?.base64, pairingCode: response.data?.pairingCode };
  } catch (err) {
    logger.error({ err, instance: instance.instanceName }, "Falha ao obter QR code da Evolution API");
    return null;
  }
}
