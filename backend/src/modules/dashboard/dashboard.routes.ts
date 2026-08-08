import { Router } from "express";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";
import { daysUntilNextDueDate } from "../../services/billingSchedule";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get("/metrics", async (_req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    openConversations,
    pendingConversations,
    totalClients,
    newClientsThisMonth,
    stages,
    billingRemindersFailedThisMonth,
    billingRemindersSentThisMonth,
    totalConversationsThisMonth,
    respondedConversationsThisMonth,
    activeSubscriptions,
    overdueSubscriptions,
    pendingFollowUps,
    pendingScheduledMessages,
    servicesWithCounts,
  ] = await Promise.all([
    prisma.conversation.count({ where: { status: "ABERTA" } }),
    prisma.conversation.count({ where: { status: "PENDENTE" } }),
    prisma.client.count(),
    prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.funnelStage.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { clients: true } } },
    }),
    prisma.billingReminderLog.count({ where: { status: "FAILED", sentAt: { gte: startOfMonth } } }),
    prisma.billingReminderLog.count({ where: { status: "SENT", sentAt: { gte: startOfMonth } } }),
    prisma.conversation.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.conversation.count({
      where: {
        createdAt: { gte: startOfMonth },
        messages: { some: { direction: "OUTBOUND" } },
      },
    }),
    prisma.clientService.findMany({ where: { status: "ATIVO" }, select: { value: true, dueDay: true } }),
    prisma.clientService.count({ where: { status: { in: ["VENCIDO", "INADIMPLENTE"] } } }),
    prisma.followUpRun.count({ where: { status: "RUNNING" } }),
    prisma.scheduledMessage.count({ where: { status: "PENDING" } }),
    prisma.service.findMany({
      where: { active: true },
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { subscriptions: { _count: "desc" } },
      take: 5,
    }),
  ]);

  const responseRate = totalConversationsThisMonth > 0 ? respondedConversationsThisMonth / totalConversationsThisMonth : 0;

  const monthlyRecurringRevenue = activeSubscriptions.reduce((sum, s) => sum + Number(s.value), 0);
  const upcomingDuesNext7Days = activeSubscriptions.filter((s) => {
    const days = daysUntilNextDueDate(s.dueDay, now);
    return days >= 0 && days <= 7;
  }).length;

  res.json({
    openConversations,
    pendingConversations,
    totalClients,
    newClientsThisMonth,
    clientsByStage: stages.map((s) => ({ id: s.id, name: s.name, color: s.color, count: s._count.clients })),
    responseRate,
    billingRemindersFailedThisMonth,
    billingRemindersSentThisMonth,
    monthlyRecurringRevenue,
    activeSubscriptions: activeSubscriptions.length,
    overdueSubscriptions,
    upcomingDuesNext7Days,
    pendingFollowUps,
    pendingScheduledMessages,
    topServices: servicesWithCounts.map((s) => ({ id: s.id, name: s.name, count: s._count.subscriptions })),
  });
});
