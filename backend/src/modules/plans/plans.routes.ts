import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, requireRole } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { logAudit } from "../../services/auditLog";

export const plansRouter = Router();
plansRouter.use(authenticate);

const planSchema = z.object({
  name: z.string().min(1),
  maxUsers: z.number().int().positive(),
  maxConversationsMo: z.number().int().positive().nullable().optional(),
  price: z.number().nonnegative(),
  features: z.record(z.any()).optional(),
  active: z.boolean().optional(),
});

plansRouter.get("/", async (_req, res) => {
  const plans = await prisma.plan.findMany({
    orderBy: { price: "asc" },
    include: { _count: { select: { users: true } } },
  });
  res.json(plans);
});

plansRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const data = planSchema.parse(req.body);
  const plan = await prisma.plan.create({ data });
  await logAudit(req.user!.sub, "create", "Plan", plan.id, { name: plan.name });
  res.status(201).json(plan);
});

plansRouter.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const data = planSchema.partial().parse(req.body);
  const plan = await prisma.plan.update({ where: { id: req.params.id }, data });
  res.json(plan);
});

plansRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const usersOnPlan = await prisma.user.count({ where: { planId: req.params.id } });
  if (usersOnPlan > 0) {
    throw new AppError("Nao e possivel excluir um plano com usuarios vinculados", 409);
  }
  await prisma.plan.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.sub, "delete", "Plan", req.params.id);
  res.status(204).send();
});
