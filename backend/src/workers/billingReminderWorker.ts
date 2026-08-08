import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { sendTextMessage } from "../services/evolution";
import { renderBillingTemplate } from "../services/billingTemplate";
import { daysUntilNextDueDate, offsetMatches, startOfDay } from "../services/billingSchedule";

async function alreadySentToday(billingReminderId: string): Promise<boolean> {
  const todayStart = startOfDay(new Date());
  const log = await prisma.billingReminderLog.findFirst({
    where: { billingReminderId, sentAt: { gte: todayStart } },
  });
  return Boolean(log);
}

async function sendReminder(
  reminder: { id: string; messageTemplate: string },
  client: { name: string; phone: string },
  clientService: { serviceName: string; value: any; dueDay: number } | null
) {
  const content = renderBillingTemplate(reminder.messageTemplate, {
    clientName: client.name,
    serviceName: clientService?.serviceName,
    value: clientService ? String(clientService.value) : undefined,
    dueDay: clientService?.dueDay,
  });

  const result = await sendTextMessage(client.phone, content);
  await prisma.billingReminderLog.create({
    data: { billingReminderId: reminder.id, status: result.success ? "SENT" : "FAILED", errorMessage: result.errorMessage },
  });
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
    if (await alreadySentToday(reminder.id)) continue;

    try {
      if (reminder.clientService) {
        if (reminder.clientService.status !== "ATIVO") continue;
        const daysToDue = daysUntilNextDueDate(reminder.clientService.dueDay, today);
        if (!offsetMatches(reminder.daysOffset, daysToDue)) continue;
        await sendReminder(reminder, reminder.clientService.client, {
          serviceName: reminder.clientService.service.name,
          value: reminder.clientService.value,
          dueDay: reminder.clientService.dueDay,
        });
      } else if (reminder.client && reminder.dueDay) {
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
