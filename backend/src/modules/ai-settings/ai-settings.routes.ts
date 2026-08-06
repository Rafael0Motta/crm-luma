import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate, requireRole } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { encryptSecret, maskSecret } from "../../services/crypto";
import { logAudit } from "../../services/auditLog";

export const aiSettingsRouter = Router();
aiSettingsRouter.use(authenticate);

const aiSettingsSchema = z.object({
  provider: z.enum(["OPENAI", "ANTHROPIC", "CUSTOM"]),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  baseUrl: z.string().url().optional().nullable(),
  systemPrompt: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  allowedAutomationIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

function serialize(settings: any) {
  const { apiKeyEncrypted, ...rest } = settings;
  return { ...rest, apiKeyMasked: maskSecret(apiKeyEncrypted ? "********" : "") };
}

aiSettingsRouter.get("/", requireRole("ADMIN"), async (_req, res) => {
  const list = await prisma.aISettings.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(list.map(serialize));
});

aiSettingsRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const data = aiSettingsSchema.parse(req.body);
  const { apiKey, ...rest } = data;

  const created = await prisma.$transaction(async (tx) => {
    if (data.active !== false) {
      await tx.aISettings.updateMany({ data: { active: false } });
    }
    return tx.aISettings.create({
      data: { ...rest, apiKeyEncrypted: encryptSecret(apiKey), active: data.active ?? true },
    });
  });

  await logAudit(req.user!.sub, "create", "AISettings", created.id, { provider: created.provider, model: created.model });
  res.status(201).json(serialize(created));
});

aiSettingsRouter.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const data = aiSettingsSchema.partial().parse(req.body);
  const { apiKey, ...rest } = data;

  const updated = await prisma.$transaction(async (tx) => {
    if (data.active) {
      await tx.aISettings.updateMany({ where: { id: { not: req.params.id } }, data: { active: false } });
    }
    return tx.aISettings.update({
      where: { id: req.params.id },
      data: { ...rest, ...(apiKey ? { apiKeyEncrypted: encryptSecret(apiKey) } : {}) },
    });
  });

  await logAudit(req.user!.sub, "update", "AISettings", updated.id, { fields: Object.keys(rest) });
  res.json(serialize(updated));
});

aiSettingsRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.aISettings.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.sub, "delete", "AISettings", req.params.id);
  res.status(204).send();
});

aiSettingsRouter.get("/active", async (_req, res) => {
  const active = await prisma.aISettings.findFirst({ where: { active: true }, orderBy: { updatedAt: "desc" } });
  if (!active) throw new AppError("Nenhuma configuracao de IA ativa", 404);
  res.json(serialize(active));
});
