import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { deliverScheduledMessageToRecipient } from "../services/scheduledMessageDelivery";

async function dispatchDueMessages() {
  const dueMessages = await prisma.scheduledMessage.findMany({
    where: { status: "PENDING", scheduledFor: { lte: new Date() } },
    include: { recipients: { where: { status: "PENDING" }, include: { client: true } } },
  });

  for (const message of dueMessages) {
    await prisma.scheduledMessage.update({ where: { id: message.id }, data: { status: "SENDING" } });

    let sent = 0;
    let failed = 0;

    for (const recipient of message.recipients) {
      try {
        const success = await deliverScheduledMessageToRecipient(recipient.id, recipient.client, message.content);
        success ? sent++ : failed++;
      } catch (err) {
        logger.error({ err, recipientId: recipient.id }, "Falha ao enviar mensagem agendada");
        failed++;
        await prisma.scheduledMessageRecipient.update({
          where: { id: recipient.id },
          data: { status: "FAILED", errorMessage: String(err) },
        });
      }
    }

    const finalStatus = failed === 0 ? "SENT" : sent === 0 ? "FAILED" : "PARTIAL";
    await prisma.scheduledMessage.update({ where: { id: message.id }, data: { status: finalStatus } });
  }
}

export const scheduledMessageWorker = new Worker(
  "scheduled-messages",
  async () => {
    await dispatchDueMessages();
  },
  { connection: redisConnection }
);

scheduledMessageWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "Job de mensagem agendada falhou");
});
