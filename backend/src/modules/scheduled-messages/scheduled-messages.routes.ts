import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { sendTextMessage } from "../../services/evolution";

export const scheduledMessagesRouter = Router();
scheduledMessagesRouter.use(authenticate);

const targetSchema = z.union([
  z.object({ targetType: z.literal("SINGLE"), targetConfig: z.object({ clientId: z.string() }) }),
  z.object({ targetType: z.literal("TAG"), targetConfig: z.object({ tagId: z.string() }) }),
  z.object({ targetType: z.literal("FUNNEL_STAGE"), targetConfig: z.object({ funnelStageId: z.string() }) }),
  z.object({ targetType: z.literal("ALL"), targetConfig: z.object({}) }),
]);

const createSchema = z
  .object({
    name: z.string().min(1),
    content: z.string().min(1),
    scheduledFor: z.string().datetime(),
  })
  .and(targetSchema);

async function resolveClientIds(targetType: string, targetConfig: any): Promise<string[]> {
  switch (targetType) {
    case "SINGLE":
      return [targetConfig.clientId];
    case "TAG": {
      const rows = await prisma.clientTag.findMany({ where: { tagId: targetConfig.tagId }, select: { clientId: true } });
      return rows.map((r) => r.clientId);
    }
    case "FUNNEL_STAGE": {
      const rows = await prisma.client.findMany({ where: { funnelStageId: targetConfig.funnelStageId }, select: { id: true } });
      return rows.map((r) => r.id);
    }
    case "ALL": {
      const rows = await prisma.client.findMany({ select: { id: true } });
      return rows.map((r) => r.id);
    }
    default:
      return [];
  }
}

scheduledMessagesRouter.get("/", async (_req, res) => {
  const messages = await prisma.scheduledMessage.findMany({
    orderBy: { scheduledFor: "desc" },
    include: { _count: { select: { recipients: true } } },
  });
  res.json(messages);
});

scheduledMessagesRouter.get("/:id", async (req, res) => {
  const message = await prisma.scheduledMessage.findUnique({
    where: { id: req.params.id },
    include: { recipients: { include: { client: { select: { id: true, name: true, phone: true } } } } },
  });
  if (!message) throw new AppError("Mensagem agendada nao encontrada", 404);
  res.json(message);
});

scheduledMessagesRouter.post("/", async (req, res) => {
  const data = createSchema.parse(req.body);
  const clientIds = await resolveClientIds(data.targetType, data.targetConfig);
  if (clientIds.length === 0) {
    throw new AppError("Nenhum destinatario encontrado para os criterios informados", 422);
  }

  const message = await prisma.scheduledMessage.create({
    data: {
      name: data.name,
      content: data.content,
      targetType: data.targetType,
      targetConfig: data.targetConfig,
      scheduledFor: new Date(data.scheduledFor),
      recipients: { createMany: { data: clientIds.map((clientId) => ({ clientId })) } },
    },
    include: { _count: { select: { recipients: true } } },
  });

  res.status(201).json(message);
});

scheduledMessagesRouter.delete("/:id", async (req, res) => {
  const message = await prisma.scheduledMessage.findUnique({ where: { id: req.params.id } });
  if (!message) throw new AppError("Mensagem agendada nao encontrada", 404);
  if (message.status !== "PENDING") {
    throw new AppError("Apenas mensagens pendentes podem ser excluidas", 409);
  }
  await prisma.scheduledMessage.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

scheduledMessagesRouter.post("/:id/send-now", async (req, res) => {
  const message = await prisma.scheduledMessage.findUnique({
    where: { id: req.params.id },
    include: { recipients: { where: { status: "PENDING" }, include: { client: true } } },
  });
  if (!message) throw new AppError("Mensagem agendada nao encontrada", 404);

  let sent = 0;
  let failed = 0;
  for (const recipient of message.recipients) {
    const result = await sendTextMessage(recipient.client.phone, message.content);
    await prisma.scheduledMessageRecipient.update({
      where: { id: recipient.id },
      data: {
        status: result.success ? "SENT" : "FAILED",
        errorMessage: result.errorMessage,
        sentAt: result.success ? new Date() : null,
      },
    });
    result.success ? sent++ : failed++;
  }

  const finalStatus = failed === 0 ? "SENT" : sent === 0 ? "FAILED" : "PARTIAL";
  await prisma.scheduledMessage.update({ where: { id: message.id }, data: { status: finalStatus } });

  res.json({ sent, failed });
});
