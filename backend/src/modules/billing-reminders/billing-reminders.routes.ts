import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { sendTextMessage } from "../../services/evolution";
import { renderBillingTemplate } from "../../services/billingTemplate";
import { logAudit } from "../../services/auditLog";

export const billingRemindersRouter = Router();
billingRemindersRouter.use(authenticate);

const baseReminderSchema = z.object({
  name: z.string().min(1),
  daysOffset: z.number().int(),
  messageTemplate: z.string().min(1),
  channel: z.literal("WHATSAPP").optional(),
  active: z.boolean().optional(),
  policyId: z.string().optional(),
  clientId: z.string().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
});

const reminderSchema = baseReminderSchema
  .refine((data) => Boolean(data.policyId) !== Boolean(data.clientId), {
    message: "Informe policyId ou clientId, mas nao ambos",
  })
  .refine((data) => !data.clientId || data.dueDay !== undefined, {
    message: "Informe o dia de vencimento (dueDay) para lembretes vinculados diretamente ao cliente",
    path: ["dueDay"],
  });

billingRemindersRouter.get("/", async (_req, res) => {
  const reminders = await prisma.billingReminder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      policy: { include: { client: { select: { id: true, name: true } } } },
      client: { select: { id: true, name: true } },
      _count: { select: { history: true } },
    },
  });
  res.json(reminders);
});

billingRemindersRouter.get("/:id/history", async (req, res) => {
  const history = await prisma.billingReminderLog.findMany({
    where: { billingReminderId: req.params.id },
    orderBy: { sentAt: "desc" },
    take: 200,
  });
  res.json(history);
});

billingRemindersRouter.post("/", async (req, res) => {
  const data = reminderSchema.parse(req.body);
  const reminder = await prisma.billingReminder.create({ data });
  await logAudit(req.user!.sub, "create", "BillingReminder", reminder.id, { name: reminder.name });
  res.status(201).json(reminder);
});

billingRemindersRouter.put("/:id", async (req, res) => {
  const data = baseReminderSchema.partial().parse(req.body);
  const reminder = await prisma.billingReminder.update({ where: { id: req.params.id }, data });
  res.json(reminder);
});

billingRemindersRouter.patch("/:id/toggle", async (req, res) => {
  const reminder = await prisma.billingReminder.findUnique({ where: { id: req.params.id } });
  if (!reminder) throw new AppError("Lembrete nao encontrado", 404);
  const updated = await prisma.billingReminder.update({ where: { id: req.params.id }, data: { active: !reminder.active } });
  res.json(updated);
});

billingRemindersRouter.delete("/:id", async (req, res) => {
  await prisma.billingReminder.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.sub, "delete", "BillingReminder", req.params.id);
  res.status(204).send();
});

billingRemindersRouter.post("/:id/send-test", async (req, res) => {
  const reminder = await prisma.billingReminder.findUnique({
    where: { id: req.params.id },
    include: { policy: { include: { client: true } }, client: true },
  });
  if (!reminder) throw new AppError("Lembrete nao encontrado", 404);

  const client = reminder.client ?? reminder.policy?.client;
  if (!client) throw new AppError("Lembrete sem cliente vinculado", 422);

  const content = renderBillingTemplate(reminder.messageTemplate, {
    clientName: client.name,
    policyNumber: reminder.policy?.policyNumber,
    insurer: reminder.policy?.insurer,
    insuranceType: reminder.policy?.insuranceType,
    value: reminder.policy ? String(reminder.policy.value) : undefined,
    dueDay: reminder.policy?.dueDay ?? reminder.dueDay ?? undefined,
  });

  const result = await sendTextMessage(client.phone, content);
  await prisma.billingReminderLog.create({
    data: {
      billingReminderId: reminder.id,
      status: result.success ? "SENT" : "FAILED",
      errorMessage: result.errorMessage,
    },
  });

  if (!result.success) throw new AppError(`Falha ao enviar: ${result.errorMessage}`, 502);
  res.json({ sent: true, content });
});
