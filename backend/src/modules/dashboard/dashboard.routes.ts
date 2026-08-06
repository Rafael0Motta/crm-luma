import { Router } from "express";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get("/metrics", async (_req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    openConversations,
    pendingConversations,
    newClientsThisMonth,
    stages,
    pendingBillingLogs,
    totalConversationsThisMonth,
    respondedConversationsThisMonth,
  ] = await Promise.all([
    prisma.conversation.count({ where: { status: "ABERTA" } }),
    prisma.conversation.count({ where: { status: "PENDENTE" } }),
    prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.funnelStage.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { clients: true } } },
    }),
    prisma.billingReminderLog.count({ where: { status: "FAILED", sentAt: { gte: startOfMonth } } }),
    prisma.conversation.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.conversation.count({
      where: {
        createdAt: { gte: startOfMonth },
        messages: { some: { direction: "OUTBOUND" } },
      },
    }),
  ]);

  const responseRate = totalConversationsThisMonth > 0 ? respondedConversationsThisMonth / totalConversationsThisMonth : 0;

  res.json({
    openConversations,
    pendingConversations,
    newClientsThisMonth,
    clientsByStage: stages.map((s) => ({ id: s.id, name: s.name, color: s.color, count: s._count.clients })),
    responseRate,
    billingRemindersFailedThisMonth: pendingBillingLogs,
  });
});
