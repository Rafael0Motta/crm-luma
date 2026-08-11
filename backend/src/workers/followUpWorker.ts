import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { sendTextMessage, SendTextResult } from "../services/evolution";
import { resolveInstanceByPurpose } from "../services/whatsappInstances";
import { findOrCreateOpenConversation } from "../services/conversationHelper";
import { publishEvent } from "../services/eventBus";

interface FollowUpStep {
  message: string;
  delayMinutes: number;
}

const RUN_COOLDOWN_HOURS = 24;

async function canStartNewRun(followUpId: string, clientId: string): Promise<boolean> {
  const cooldownSince = new Date(Date.now() - RUN_COOLDOWN_HOURS * 60 * 60 * 1000);
  const recentOrRunning = await prisma.followUpRun.findFirst({
    where: {
      followUpId,
      clientId,
      OR: [{ status: "RUNNING" }, { updatedAt: { gte: cooldownSince } }],
    },
  });
  return !recentOrRunning;
}

function noResponseThresholdHours(config: any): number {
  // formato legado: { hours: number }. formato atual: { amount: number, unit: "minutes" | "hours" | "days" }
  if (typeof config.hours === "number") return config.hours;
  const amount = typeof config.amount === "number" ? config.amount : 24;
  if (config.unit === "minutes") return amount / 60;
  if (config.unit === "days") return amount * 24;
  return amount;
}

async function findEligibleClientsForNoResponse(hours: number): Promise<{ clientId: string; conversationId: string }[]> {
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);
  const conversations = await prisma.conversation.findMany({
    where: {
      status: { in: ["ABERTA", "PENDENTE"] },
      lastMessageAt: { lte: threshold },
    },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return conversations
    .filter((c) => c.messages[0]?.direction === "OUTBOUND")
    .map((c) => ({ clientId: c.clientId, conversationId: c.id }));
}

async function findEligibleClientsForStuckInStage(funnelStageId: string, days: number): Promise<{ clientId: string }[]> {
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const clients = await prisma.client.findMany({
    where: { funnelStageId, updatedAt: { lte: threshold } },
    select: { id: true },
  });
  return clients.map((c) => ({ clientId: c.id }));
}

async function findEligibleClientsForTag(tagId: string): Promise<{ clientId: string }[]> {
  const rows = await prisma.clientTag.findMany({ where: { tagId }, select: { clientId: true } });
  return rows.map((r) => ({ clientId: r.clientId }));
}

async function scanAndStartRuns() {
  const followUps = await prisma.followUp.findMany({ where: { active: true } });

  for (const followUp of followUps) {
    const config = followUp.triggerConfig as any;
    let candidates: { clientId: string; conversationId?: string }[] = [];

    if (followUp.triggerType === "NO_RESPONSE") {
      candidates = await findEligibleClientsForNoResponse(noResponseThresholdHours(config));
    } else if (followUp.triggerType === "STUCK_IN_STAGE") {
      candidates = await findEligibleClientsForStuckInStage(config.funnelStageId, config.days);
    } else if (followUp.triggerType === "AFTER_TAG") {
      candidates = await findEligibleClientsForTag(config.tagId);
    }

    for (const candidate of candidates) {
      const canStart = await canStartNewRun(followUp.id, candidate.clientId);
      if (!canStart) continue;

      await prisma.followUpRun.create({
        data: {
          followUpId: followUp.id,
          clientId: candidate.clientId,
          conversationId: candidate.conversationId,
          currentStep: 0,
          status: "RUNNING",
          nextRunAt: new Date(),
        },
      });
    }
  }
}

async function processDueRuns() {
  const dueRuns = await prisma.followUpRun.findMany({
    where: { status: "RUNNING", nextRunAt: { lte: new Date() } },
    include: { followUp: true, client: true },
  });
  if (dueRuns.length === 0) return;

  const instance = await resolveInstanceByPurpose("FOLLOWUP");

  for (const run of dueRuns) {
    const steps = (run.followUp.steps as unknown as FollowUpStep[]) ?? [];
    const step = steps[run.currentStep];

    if (!step) {
      await prisma.followUpRun.update({ where: { id: run.id }, data: { status: "COMPLETED", nextRunAt: null } });
      continue;
    }

    try {
      const result: SendTextResult = instance
        ? await sendTextMessage(instance, run.client.phone, step.message)
        : { success: false, errorMessage: "Evolution API nao configurada para follow-ups" };

      const conversation = run.conversationId
        ? await prisma.conversation.findUnique({ where: { id: run.conversationId } })
        : await findOrCreateOpenConversation(run.clientId, run.client.phone);

      if (conversation) {
        const message = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: "OUTBOUND",
            type: "TEXT",
            content: step.message,
            status: result.success ? "SENT" : "FAILED",
            sender: "AUTOMATION",
            evolutionMessageId: result.evolutionMessageId,
            errorMessage: result.errorMessage,
            instanceId: instance?.instanceId ?? undefined,
          },
        });
        await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
        await publishEvent({ type: "message", conversationId: conversation.id, message });
      }

      const nextStep = run.currentStep + 1;
      const nextStepConfig = steps[nextStep];

      if (!nextStepConfig) {
        await prisma.followUpRun.update({
          where: { id: run.id },
          data: { status: "COMPLETED", currentStep: nextStep, nextRunAt: null },
        });
      } else {
        await prisma.followUpRun.update({
          where: { id: run.id },
          data: {
            currentStep: nextStep,
            nextRunAt: new Date(Date.now() + nextStepConfig.delayMinutes * 60 * 1000),
          },
        });
      }
    } catch (err) {
      logger.error({ err, runId: run.id }, "Falha ao processar follow-up run");
      await prisma.followUpRun.update({ where: { id: run.id }, data: { status: "FAILED" } });
    }
  }
}

export const followUpWorker = new Worker(
  "follow-ups",
  async () => {
    await scanAndStartRuns();
    await processDueRuns();
  },
  { connection: redisConnection }
);

followUpWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "Job de follow-up falhou");
});
