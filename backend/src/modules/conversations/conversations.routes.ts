import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { mediaTypeFromMimetype, sendMediaMessage, sendTextMessage } from "../../services/evolution";
import { saveBufferToUploads } from "../../services/mediaStorage";
import { cancelPendingFollowUpsForClient } from "../../services/automationEngine";

const MEDIA_TYPE_TO_MESSAGE_TYPE = { image: "IMAGE", video: "VIDEO", audio: "AUDIO", document: "DOCUMENT" } as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const conversationsRouter = Router();
conversationsRouter.use(authenticate);

conversationsRouter.get("/", async (req, res) => {
  const { status, assignedUserId, page, pageSize } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Math.max(1, Number(pageSize) || 50));

  const conversations = await prisma.conversation.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(assignedUserId ? { assignedUserId } : {}),
    },
    include: {
      client: { include: { tags: { include: { tag: true } } } },
      assignedUser: { select: { id: true, name: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    skip: (pageNum - 1) * size,
    take: size,
  });

  res.json(
    conversations.map((c) => ({
      ...c,
      client: c.client ? { ...c.client, tags: c.client.tags.map((t) => t.tag) } : null,
    }))
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

conversationsRouter.post("/:id/resolve-followups", async (req, res) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) throw new AppError("Conversa nao encontrada", 404);
  await cancelPendingFollowUpsForClient(conversation.clientId);
  res.status(204).send();
});
