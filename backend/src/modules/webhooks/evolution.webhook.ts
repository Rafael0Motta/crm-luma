import { Router } from "express";
import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";
import { runAutomationsForEvent, cancelPendingFollowUpsForClient } from "../../services/automationEngine";
import { getBase64FromMediaMessage } from "../../services/evolution";
import { saveBase64ToUploads } from "../../services/mediaStorage";
import { publishEvent } from "../../services/eventBus";
import { MessageType } from "@prisma/client";

export const evolutionWebhookRouter = Router();

interface EvolutionMessageData {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    audioMessage?: Record<string, unknown>;
    documentMessage?: { caption?: string; fileName?: string };
    videoMessage?: { caption?: string };
  };
  pushName?: string;
  messageType?: string;
}

const MEDIA_FIELD_TO_TYPE: { field: keyof NonNullable<EvolutionMessageData["message"]>; type: MessageType }[] = [
  { field: "imageMessage", type: "IMAGE" },
  { field: "audioMessage", type: "AUDIO" },
  { field: "documentMessage", type: "DOCUMENT" },
  { field: "videoMessage", type: "VIDEO" },
];

function extractText(data: EvolutionMessageData): string {
  return (
    data.message?.conversation ??
    data.message?.extendedTextMessage?.text ??
    data.message?.imageMessage?.caption ??
    data.message?.documentMessage?.caption ??
    data.message?.videoMessage?.caption ??
    ""
  );
}

function detectMediaType(data: EvolutionMessageData): MessageType | null {
  for (const { field, type } of MEDIA_FIELD_TO_TYPE) {
    if (data.message?.[field]) return type;
  }
  return null;
}

function extractPhone(remoteJid: string | undefined): string | null {
  if (!remoteJid) return null;
  const [id] = remoteJid.split("@");
  if (!id || remoteJid.includes("@g.us")) return null; // ignora grupos
  return id;
}

async function resolveInboundMedia(data: EvolutionMessageData): Promise<{ type: MessageType; mediaUrl: string | null } | null> {
  const mediaType = detectMediaType(data);
  if (!mediaType || !data.key?.id || !data.key?.remoteJid) return null;

  const media = await getBase64FromMediaMessage(data.key.id, data.key.remoteJid);
  if (!media) {
    // Nao foi possivel obter a midia (API antiga, midia expirada, etc) - registra a mensagem mesmo assim, sem anexo.
    return { type: mediaType, mediaUrl: null };
  }

  const fileName = data.message?.documentMessage?.fileName;
  const saved = saveBase64ToUploads(media.base64, media.mimetype, fileName);
  return { type: mediaType, mediaUrl: saved.relativeUrl };
}

async function handleInboundMessage(data: EvolutionMessageData) {
  const phone = extractPhone(data.key?.remoteJid);
  if (!phone || data.key?.fromMe) return;

  const text = extractText(data);
  const media = await resolveInboundMedia(data);

  let client = await prisma.client.findUnique({ where: { phone } });
  if (!client) {
    client = await prisma.client.create({
      data: { name: data.pushName || phone, phone },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: { clientId: client.id, status: { in: ["ABERTA", "PENDENTE"] } },
    orderBy: { createdAt: "desc" },
  });

  const isNewConversation = !conversation;
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { clientId: client.id, whatsappNumber: phone, status: "ABERTA" },
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "INBOUND",
      type: media?.type ?? "TEXT",
      content: text,
      mediaUrl: media?.mediaUrl,
      status: "DELIVERED",
      sender: "HUMAN",
      evolutionMessageId: data.key?.id,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), unreadCount: { increment: 1 }, status: "ABERTA" },
  });

  await publishEvent({ type: "message", conversationId: conversation.id, message });

  await cancelPendingFollowUpsForClient(client.id);

  if (isNewConversation) {
    await runAutomationsForEvent({ trigger: "new_conversation", clientId: client.id, conversationId: conversation.id });
  }

  await runAutomationsForEvent({
    trigger: "message_received",
    clientId: client.id,
    conversationId: conversation.id,
    messageContent: text,
  });
}

async function handleMessageStatusUpdate(data: { key?: { id?: string }; status?: string }) {
  if (!data.key?.id) return;
  const statusMap: Record<string, string> = {
    DELIVERY_ACK: "DELIVERED",
    READ: "READ",
    SERVER_ACK: "SENT",
  };
  const status = statusMap[data.status ?? ""] ?? undefined;
  if (!status) return;

  await prisma.message.updateMany({
    where: { evolutionMessageId: data.key.id },
    data: { status: status as any },
  });
}

evolutionWebhookRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const event = String(body.event ?? "").toLowerCase();

  try {
    if (event.includes("messages.upsert") || event.includes("messages_upsert")) {
      const dataList = Array.isArray(body.data) ? body.data : [body.data];
      for (const item of dataList) {
        if (item) await handleInboundMessage(item);
      }
    } else if (event.includes("messages.update") || event.includes("messages_update")) {
      const dataList = Array.isArray(body.data) ? body.data : [body.data];
      for (const item of dataList) {
        if (item) await handleMessageStatusUpdate(item);
      }
    } else if (event.includes("connection.update") || event.includes("connection_update")) {
      logger.info({ data: body.data }, "Evolution API: atualizacao de conexao");
    } else {
      logger.debug({ event }, "Evolution API: evento nao tratado");
    }

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error({ err, body }, "Erro ao processar webhook da Evolution API");
    res.status(200).json({ received: true, error: "processing_failed" });
  }
});
