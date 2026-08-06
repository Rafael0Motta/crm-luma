import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { mediaTypeFromMimetype, sendMediaMessage, sendTextMessage } from "../../services/evolution";
import { saveBufferToUploads } from "../../services/mediaStorage";
import { cancelPendingFollowUpsForClient } from "../../services/automationEngine";
import { publishEvent } from "../../services/eventBus";
import { findOrCreateOpenConversation } from "../../services/conversationHelper";
import { logAudit } from "../../services/auditLog";

const MEDIA_TYPE_TO_MESSAGE_TYPE = { image: "IMAGE", video: "VIDEO", audio: "AUDIO", document: "DOCUMENT" } as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const conversationsRouter = Router();
conversationsRouter.use(authenticate);

conversationsRouter.get("/", async (req, res) => {
  const { status, assignedUserId, search, page, pageSize } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Math.max(1, Number(pageSize) || 50));

  const conversations = await prisma.conversation.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(assignedUserId ? { assignedUserId } : {}),
      ...(search
        ? {
            client: {
              OR: [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }],
            },
          }
        : {}),
    },
    include: {
      client: { include: { tags: { include: { tag: true } } } },
      assignedUser: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
    skip: (pageNum - 1) * size,
    take: size,
  });

  res.json(
    conversations.map((c) => {
      const { messages, ...rest } = c;
      return {
        ...rest,
        client: c.client ? { ...c.client, tags: c.client.tags.map((t) => t.tag) } : null,
        lastMessagePreview: messages[0]
          ? { content: messages[0].content, type: messages[0].type, direction: messages[0].direction, sender: messages[0].sender }
          : null,
      };
    })
  );
});

conversationsRouter.get("/:id/messages", async (req, res) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) throw new AppError("Conversa nao encontrada", 404);

  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: "asc" },
  });

  await prisma.conversation.update({ where: { id: req.params.id }, data: { unreadCount: 0 } });

  res.json(messages);
});

const sendMessageSchema = z.object({ content: z.string().min(1) });

conversationsRouter.post("/:id/messages", async (req, res) => {
  const { content } = sendMessageSchema.parse(req.body);
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) throw new AppError("Conversa nao encontrada", 404);

  const result = await sendTextMessage(conversation.whatsappNumber, content);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      type: "TEXT",
      content,
      status: result.success ? "SENT" : "FAILED",
      sender: "HUMAN",
      senderUserId: req.user!.sub,
      evolutionMessageId: result.evolutionMessageId,
      errorMessage: result.errorMessage,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  await publishEvent({ type: "message", conversationId: conversation.id, message });

  if (!result.success) {
    throw new AppError(`Falha ao enviar mensagem: ${result.errorMessage}`, 502, { message });
  }

  res.status(201).json(message);
});

conversationsRouter.post("/:id/messages/media", upload.single("file"), async (req, res) => {
  if (!req.file) throw new AppError("Nenhum arquivo enviado", 400);

  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) throw new AppError("Conversa nao encontrada", 404);

  const caption = typeof req.body.caption === "string" ? req.body.caption : undefined;
  const mediatype = mediaTypeFromMimetype(req.file.mimetype);
  const base64 = req.file.buffer.toString("base64");

  const result = await sendMediaMessage(conversation.whatsappNumber, base64, mediatype, req.file.originalname, caption);
  const saved = saveBufferToUploads(req.file.buffer, req.file.mimetype, req.file.originalname);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      type: MEDIA_TYPE_TO_MESSAGE_TYPE[mediatype],
      content: caption ?? "",
      mediaUrl: saved.relativeUrl,
      status: result.success ? "SENT" : "FAILED",
      sender: "HUMAN",
      senderUserId: req.user!.sub,
      evolutionMessageId: result.evolutionMessageId,
      errorMessage: result.errorMessage,
    },
  });

  await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

  await publishEvent({ type: "message", conversationId: conversation.id, message });

  if (!result.success) {
    throw new AppError(`Falha ao enviar midia: ${result.errorMessage}`, 502, { message });
  }

  res.status(201).json(message);
});

conversationsRouter.put("/:id/status", async (req, res) => {
  const { status } = z.object({ status: z.enum(["ABERTA", "PENDENTE", "RESOLVIDA"]) }).parse(req.body);
  const conversation = await prisma.conversation.update({ where: { id: req.params.id }, data: { status } });
  res.json(conversation);
});

conversationsRouter.put("/:id/assign", async (req, res) => {
  const { userId } = z.object({ userId: z.string().nullable() }).parse(req.body);
  const conversation = await prisma.conversation.update({ where: { id: req.params.id }, data: { assignedUserId: userId } });
  res.json(conversation);
});

conversationsRouter.put("/:id/ai-toggle", async (req, res) => {
  const { aiEnabled } = z.object({ aiEnabled: z.boolean() }).parse(req.body);
  const conversation = await prisma.conversation.update({ where: { id: req.params.id }, data: { aiEnabled } });
  res.json(conversation);
});

conversationsRouter.post("/:id/resolve-followups", async (req, res) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) throw new AppError("Conversa nao encontrada", 404);
  await cancelPendingFollowUpsForClient(conversation.clientId);
  res.status(204).send();
});

const CONVERSATION_DETAIL_INCLUDE = {
  client: { include: { tags: { include: { tag: true } } } },
  assignedUser: { select: { id: true, name: true } },
} as const;

function serializeConversation(conversation: any) {
  return {
    ...conversation,
    client: conversation.client ? { ...conversation.client, tags: conversation.client.tags.map((t: any) => t.tag) } : null,
    lastMessagePreview: null,
  };
}

const startConversationSchema = z.object({
  phone: z.string().min(8),
  name: z.string().min(1).optional(),
});

conversationsRouter.post("/start", async (req, res) => {
  const { phone, name } = startConversationSchema.parse(req.body);
  const normalizedPhone = phone.replace(/\D/g, "");
  if (normalizedPhone.length < 8) throw new AppError("Telefone invalido", 422);

  let client = await prisma.client.findUnique({ where: { phone: normalizedPhone } });
  if (!client) {
    client = await prisma.client.create({ data: { name: name || normalizedPhone, phone: normalizedPhone } });
    await logAudit(req.user!.sub, "create", "Client", client.id, { name: client.name, source: "manual_conversation" });
  }

  const conversation = await findOrCreateOpenConversation(client.id, normalizedPhone);
  const full = await prisma.conversation.findUnique({ where: { id: conversation.id }, include: CONVERSATION_DETAIL_INCLUDE });

  res.status(201).json(serializeConversation(full));
});

conversationsRouter.get("/stale", async (req, res) => {
  const hours = Math.max(1, Number(req.query.hours) || 24);
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);

  const conversations = await prisma.conversation.findMany({
    where: { status: { in: ["ABERTA", "PENDENTE"] }, lastMessageAt: { lte: threshold } },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "asc" },
  });

  const stale = conversations.filter((c) => c.messages[0]?.direction === "OUTBOUND");

  res.json(
    stale.map((c) => ({
      id: c.id,
      client: c.client,
      lastMessageAt: c.lastMessageAt,
      hoursSinceLastMessage: c.lastMessageAt ? Math.floor((Date.now() - c.lastMessageAt.getTime()) / (60 * 60 * 1000)) : null,
    }))
  );
});
