import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { sendTextMessage } from "../services/evolution";
import { renderBillingTemplate } from "../services/billingTemplate";
import { daysUntilNextDueDate, offsetMatches, startOfDay } from "../services/billingSchedule";

async function alreadySentToday(billingReminderId: string, clientId: string | null): Promise<boolean> {
  const todayStart = startOfDay(new Date());
  const log = await prisma.billingReminderLog.findFirst({
    where: { billingReminderId, sentAt: { gte: todayStart }, ...(clientId ? { clientId } : {}) },
  });
  return Boolean(log);
}

async function sendReminder(
  reminder: { id: string; messageTemplate: string },
  client: { id: string; name: string; phone: string },
  serviceInfo: { serviceName: string; value: any; dueDay: number } | null
) {
  const content = renderBillingTemplate(reminder.messageTemplate, {
    clientName: client.name,
    serviceName: serviceInfo?.serviceName,
    value: serviceInfo ? String(serviceInfo.value) : undefined,
    dueDay: serviceInfo?.dueDay,
  });

  const result = await sendTextMessage(client.phone, content);
  await prisma.billingReminderLog.create({
    data: {
      billingReminderId: reminder.id,
      clientId: client.id,
      status: result.success ? "SENT" : "FAILED",
      errorMessage: result.errorMessage,
    },
  });
}

async function processStandardServiceReminder(reminder: { id: string; serviceId: string; messageTemplate: string; daysOffset: number }, today: Date) {
  const subscriptions = await prisma.clientService.findMany({
    where: { serviceId: reminder.serviceId, status: "ATIVO" },
    include: { client: true, service: true },
  });

  for (const sub of subscriptions) {
    try {
      if (await alreadySentToday(reminder.id, sub.clientId)) continue;
      const daysToDue = daysUntilNextDueDate(sub.dueDay, today);
      if (!offsetMatches(reminder.daysOffset, daysToDue)) continue;
      await sendReminder(reminder, sub.client, { serviceName: sub.service.name, value: sub.value, dueDay: sub.dueDay });
    } catch (err) {
      logger.error({ err, reminderId: reminder.id, clientId: sub.clientId }, "Falha ao enviar lembrete de cobranca padrao");
    }
  }
}

async function processBillingReminders() {
  const today = new Date();
  const reminders = await prisma.billingReminder.findMany({
    where: { active: true },
    include: {
      clientService: { include: { client: true, service: true } },
      client: true,
    },
  });

  for (const reminder of reminders) {
    try {
      if (reminder.serviceId) {
        await processStandardServiceReminder(reminder as any, today);
      } else if (reminder.clientService) {
        if (reminder.clientService.status !== "ATIVO") continue;
        if (await alreadySentToday(reminder.id, reminder.clientService.clientId)) continue;
        const daysToDue = daysUntilNextDueDate(reminder.clientService.dueDay, today);
        if (!offsetMatches(reminder.daysOffset, daysToDue)) continue;
        await sendReminder(reminder, reminder.clientService.client, {
          serviceName: reminder.clientService.service.name,
          value: reminder.clientService.value,
          dueDay: reminder.clientService.dueDay,
        });
      } else if (reminder.client && reminder.dueDay) {
        if (await alreadySentToday(reminder.id, reminder.clientId)) continue;
        const daysToDue = daysUntilNextDueDate(reminder.dueDay, today);
        if (!offsetMatches(reminder.daysOffset, daysToDue)) continue;
        await sendReminder(reminder, reminder.client, null);
      }
    } catch (err) {
      logger.error({ err, reminderId: reminder.id }, "Falha ao enviar lembrete de cobranca");
    }
  }
}

export const billingReminderWorker = new Worker(
  "billing-reminders",
  async () => {
    await processBillingReminders();
  },
  { connection: redisConnection }
);

billingReminderWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "Job de lembrete de cobranca falhou");
});
