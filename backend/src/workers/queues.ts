import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const followUpQueue = new Queue("follow-ups", { connection: redisConnection });
export const scheduledMessageQueue = new Queue("scheduled-messages", { connection: redisConnection });
export const billingReminderQueue = new Queue("billing-reminders", { connection: redisConnection });

export async function scheduleRepeatableJobs() {
  await followUpQueue.add(
    "scan-and-process",
    {},
    { repeat: { pattern: "*/5 * * * *" }, jobId: "follow-ups-scan" }
  );

  await scheduledMessageQueue.add(
    "dispatch-due",
    {},
    { repeat: { pattern: "*/1 * * * *" }, jobId: "scheduled-messages-dispatch" }
  );

  await billingReminderQueue.add(
    "daily-check",
    {},
    { repeat: { pattern: "0 8 * * *" }, jobId: "billing-reminders-daily" }
  );
}
