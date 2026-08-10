import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { logAudit } from "../../services/auditLog";

export const followUpsRouter = Router();
followUpsRouter.use(authenticate);

const stepSchema = z.object({
  message: z.string().min(1),
  delayMinutes: z.number().int().nonnegative(),
});

const triggerConfigSchema = z.union([
  z.object({ type: z.literal("NO_RESPONSE"), amount: z.number().positive(), unit: z.enum(["minutes", "hours", "days"]) }),
  z.object({ type: z.literal("STUCK_IN_STAGE"), funnelStageId: z.string(), days: z.number().positive() }),
  z.object({ type: z.literal("AFTER_TAG"), tagId: z.string() }),
]);

const followUpSchema = z.object({
  name: z.string().min(1),
  triggerType: z.enum(["NO_RESPONSE", "STUCK_IN_STAGE", "AFTER_TAG"]),
  triggerConfig: triggerConfigSchema,
  steps: z.array(stepSchema).min(1),
  stopCondition: z
    .object({
      onReply: z.boolean().optional(),
      onFunnelStageChange: z.boolean().optional(),
    })
    .default({ onReply: true }),
  active: z.boolean().optional(),
});

followUpsRouter.get("/", async (_req, res) => {
  const followUps = await prisma.followUp.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { runs: true } } },
  });
  res.json(followUps);
});

followUpsRouter.get("/:id", async (req, res) => {
  const followUp = await prisma.followUp.findUnique({ where: { id: req.params.id } });
  if (!followUp) throw new AppError("Follow-up nao encontrado", 404);
  res.json(followUp);
});

followUpsRouter.get("/:id/runs", async (req, res) => {
  const runs = await prisma.followUpRun.findMany({
    where: { followUpId: req.params.id },
    include: { client: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(runs);
});

followUpsRouter.post("/", async (req, res) => {
  const data = followUpSchema.parse(req.body);
  const followUp = await prisma.followUp.create({ data });
  await logAudit(req.user!.sub, "create", "FollowUp", followUp.id, { name: followUp.name });
  res.status(201).json(followUp);
});

followUpsRouter.put("/:id", async (req, res) => {
  const data = followUpSchema.partial().parse(req.body);
  const followUp = await prisma.followUp.update({ where: { id: req.params.id }, data });
  await logAudit(req.user!.sub, "update", "FollowUp", followUp.id);
  res.json(followUp);
});

followUpsRouter.patch("/:id/toggle", async (req, res) => {
  const followUp = await prisma.followUp.findUnique({ where: { id: req.params.id } });
  if (!followUp) throw new AppError("Follow-up nao encontrado", 404);
  const updated = await prisma.followUp.update({ where: { id: req.params.id }, data: { active: !followUp.active } });
  await logAudit(req.user!.sub, "toggle", "FollowUp", updated.id, { active: updated.active });
  res.json(updated);
});

followUpsRouter.delete("/:id", async (req, res) => {
  await prisma.followUp.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.sub, "delete", "FollowUp", req.params.id);
  res.status(204).send();
});
