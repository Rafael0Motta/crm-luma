import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { runAutomationsForEvent } from "../../services/automationEngine";
import { logAudit } from "../../services/auditLog";

export const automationsRouter = Router();
automationsRouter.use(authenticate);

const conditionSchema = z.object({
  field: z.enum(["message.content", "client.name", "client.phone", "client.funnelStageId", "tag.id"]),
  operator: z.enum(["equals", "not_equals", "contains", "not_contains"]),
  value: z.string(),
});

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("send_message"), content: z.string().min(1) }),
  z.object({ type: z.literal("apply_tag"), tagId: z.string() }),
  z.object({ type: z.literal("move_funnel_stage"), funnelStageId: z.string() }),
  z.object({ type: z.literal("assign_user"), userId: z.string() }),
  z.object({ type: z.literal("trigger_ai") }),
  z.object({ type: z.literal("notify_internal"), message: z.string().min(1) }),
]);

const automationSchema = z.object({
  name: z.string().min(1),
  trigger: z.enum(["new_conversation", "message_received", "funnel_stage_changed", "tag_applied"]),
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSchema).min(1),
  active: z.boolean().optional(),
});

automationsRouter.get("/", async (_req, res) => {
  const automations = await prisma.automation.findMany({ orderBy: { createdAt: "desc" } });
  res.json(automations);
});

automationsRouter.get("/:id", async (req, res) => {
  const automation = await prisma.automation.findUnique({ where: { id: req.params.id } });
  if (!automation) throw new AppError("Automacao nao encontrada", 404);
  res.json(automation);
});

automationsRouter.post("/", async (req, res) => {
  const data = automationSchema.parse(req.body);
  const automation = await prisma.automation.create({ data });
  await logAudit(req.user!.sub, "create", "Automation", automation.id, { name: automation.name, trigger: automation.trigger });
  res.status(201).json(automation);
});

automationsRouter.put("/:id", async (req, res) => {
  const data = automationSchema.partial().parse(req.body);
  const automation = await prisma.automation.update({ where: { id: req.params.id }, data });
  await logAudit(req.user!.sub, "update", "Automation", automation.id);
  res.json(automation);
});

automationsRouter.patch("/:id/toggle", async (req, res) => {
  const automation = await prisma.automation.findUnique({ where: { id: req.params.id } });
  if (!automation) throw new AppError("Automacao nao encontrada", 404);
  const updated = await prisma.automation.update({ where: { id: req.params.id }, data: { active: !automation.active } });
  await logAudit(req.user!.sub, "toggle", "Automation", updated.id, { active: updated.active });
  res.json(updated);
});

automationsRouter.delete("/:id", async (req, res) => {
  await prisma.automation.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.sub, "delete", "Automation", req.params.id);
  res.status(204).send();
});

const simulateSchema = z.object({
  clientId: z.string(),
  trigger: z.enum(["new_conversation", "message_received", "funnel_stage_changed", "tag_applied"]),
  messageContent: z.string().optional(),
  funnelStageId: z.string().optional(),
  tagId: z.string().optional(),
});

automationsRouter.post("/:id/simulate", async (req, res) => {
  const automation = await prisma.automation.findUnique({ where: { id: req.params.id } });
  if (!automation) throw new AppError("Automacao nao encontrada", 404);

  const { clientId, trigger, messageContent, funnelStageId, tagId } = simulateSchema.parse(req.body);
  if (trigger !== automation.trigger) {
    return res.json({ matched: false, reason: "O gatilho informado nao corresponde ao gatilho da automacao" });
  }

  await runAutomationsForEvent({ trigger, clientId, messageContent, funnelStageId, tagId });
  res.json({ matched: true });
});
