import axios from "axios";
import { prisma } from "../config/prisma";
import { decryptSecret } from "./crypto";
import { logger } from "../config/logger";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generateAIReply(conversationHistory: ChatMessage[]): Promise<string | null> {
  const settings = await prisma.aISettings.findFirst({ where: { active: true }, orderBy: { updatedAt: "desc" } });
  if (!settings) {
    logger.warn("Nenhuma configuracao de IA ativa encontrada");
    return null;
  }

  const apiKey = decryptSecret(settings.apiKeyEncrypted);

  try {
    if (settings.provider === "OPENAI") {
      return await callOpenAI(settings, apiKey, conversationHistory);
    }
    if (settings.provider === "ANTHROPIC") {
      return await callAnthropic(settings, apiKey, conversationHistory);
    }
    return await callOpenAICompatible(settings, apiKey, conversationHistory);
  } catch (err) {
    const detail = axios.isAxiosError(err) ? JSON.stringify(err.response?.data) : String(err);
    logger.error({ detail }, "Falha ao gerar resposta de IA");
    return null;
  }
}

async function callOpenAI(settings: { model: string; systemPrompt: string; temperature: any; maxTokens: number }, apiKey: string, history: ChatMessage[]) {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: settings.model,
      temperature: Number(settings.temperature),
      max_tokens: settings.maxTokens,
      messages: [{ role: "system", content: settings.systemPrompt }, ...history],
    },
    { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, timeout: 30000 }
  );
  return response.data?.choices?.[0]?.message?.content?.trim() ?? null;
}

async function callAnthropic(settings: { model: string; systemPrompt: string; temperature: any; maxTokens: number }, apiKey: string, history: ChatMessage[]) {
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: settings.model,
      system: settings.systemPrompt,
      max_tokens: settings.maxTokens,
      temperature: Number(settings.temperature),
      messages: history,
    },
    {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      timeout: 30000,
    }
  );
  const blocks = response.data?.content ?? [];
  return blocks.map((b: { type: string; text?: string }) => b.text ?? "").join("").trim() || null;
}

async function callOpenAICompatible(
  settings: { model: string; systemPrompt: string; temperature: any; maxTokens: number; baseUrl: string | null },
  apiKey: string,
  history: ChatMessage[]
) {
  if (!settings.baseUrl) {
    logger.warn("Provedor de IA customizado sem baseUrl configurada");
    return null;
  }
  const response = await axios.post(
    `${settings.baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      model: settings.model,
      temperature: Number(settings.temperature),
      max_tokens: settings.maxTokens,
      messages: [{ role: "system", content: settings.systemPrompt }, ...history],
    },
    { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, timeout: 30000 }
  );
  return response.data?.choices?.[0]?.message?.content?.trim() ?? null;
}
