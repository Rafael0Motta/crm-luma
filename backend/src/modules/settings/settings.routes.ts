import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { authenticate, requireRole } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { getConnectionState, getQrCode } from "../../services/evolution";
import { InstanceCredentials } from "../../services/whatsappInstances";
import { logAudit } from "../../services/auditLog";

export const settingsRouter = Router();
settingsRouter.use(authenticate);

settingsRouter.get("/evolution/status", requireRole("ADMIN"), async (_req, res) => {
  if (!env.evolutionApiUrl || !env.evolutionInstanceName) {
    return res.json({ configured: false, instanceName: env.evolutionInstanceName, state: "not_configured" });
  }
  const credentials: InstanceCredentials = {
    instanceId: null,
    instanceName: env.evolutionInstanceName,
    apiUrl: env.evolutionApiUrl,
    apiKey: env.evolutionApiKey,
  };
  const state = await getConnectionState(credentials);
  res.json({ configured: true, instanceName: env.evolutionInstanceName, state: state?.state ?? "not_configured" });
});

settingsRouter.get("/evolution/qrcode", requireRole("ADMIN"), async (_req, res) => {
  if (!env.evolutionApiUrl || !env.evolutionInstanceName) return res.json({ base64: null });
  const credentials: InstanceCredentials = {
    instanceId: null,
    instanceName: env.evolutionInstanceName,
    apiUrl: env.evolutionApiUrl,
    apiKey: env.evolutionApiKey,
  };
  const qr = await getQrCode(credentials);
  res.json(qr ?? { base64: null });
});

const instanceSchema = z.object({
  label: z.string().min(1),
  instanceName: z.string().min(1),
  apiUrl: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().optional().or(z.literal("")),
  purpose: z.enum(["ATENDIMENTO", "FOLLOWUP", "COBRANCA"]),
  active: z.boolean().optional(),
});

async function assertSinglePurposeActive(purpose: string, active: boolean | undefined, excludeId?: string) {
  if (!active) return;
  const conflicting = await prisma.whatsAppInstance.findFirst({
    where: { purpose: purpose as any, active: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (conflicting) {
    throw new AppError(
      `Ja existe uma instancia ativa para "${purpose}" (${conflicting.label}). Desative-a antes de ativar outra.`,
      409
    );
  }
}

function serializeInstance(instance: { apiKey: string | null; [key: string]: unknown }) {
  const { apiKey, ...rest } = instance;
  return { ...rest, apiKeyMasked: apiKey ? "••••••••" : null };
}

settingsRouter.get("/whatsapp-instances", requireRole("ADMIN"), async (_req, res) => {
  const instances = await prisma.whatsAppInstance.findMany({ orderBy: { createdAt: "asc" } });
  res.json(instances.map(serializeInstance));
});

settingsRouter.post("/whatsapp-instances", requireRole("ADMIN"), async (req, res) => {
  const data = instanceSchema.parse(req.body);
  await assertSinglePurposeActive(data.purpose, data.active ?? true);

  const instance = await prisma.whatsAppInstance.create({
    data: {
      label: data.label,
      instanceName: data.instanceName,
      apiUrl: data.apiUrl || null,
      apiKey: data.apiKey || null,
      purpose: data.purpose,
      active: data.active ?? true,
    },
  });
  await logAudit(req.user!.sub, "create", "WhatsAppInstance", instance.id, { label: instance.label, purpose: instance.purpose });
  res.status(201).json(serializeInstance(instance));
});

settingsRouter.put("/whatsapp-instances/:id", requireRole("ADMIN"), async (req, res) => {
  const data = instanceSchema.partial().parse(req.body);
  const existing = await prisma.whatsAppInstance.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError("Instancia nao encontrada", 404);

  await assertSinglePurposeActive(data.purpose ?? existing.purpose, data.active ?? existing.active, existing.id);

  const instance = await prisma.whatsAppInstance.update({
    where: { id: req.params.id },
    data: {
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.instanceName !== undefined ? { instanceName: data.instanceName } : {}),
      ...(data.apiUrl !== undefined ? { apiUrl: data.apiUrl || null } : {}),
      ...(data.apiKey ? { apiKey: data.apiKey } : {}),
      ...(data.purpose !== undefined ? { purpose: data.purpose } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });
  await logAudit(req.user!.sub, "update", "WhatsAppInstance", instance.id);
  res.json(serializeInstance(instance));
});

settingsRouter.patch("/whatsapp-instances/:id/toggle", requireRole("ADMIN"), async (req, res) => {
  const existing = await prisma.whatsAppInstance.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new AppError("Instancia nao encontrada", 404);

  await assertSinglePurposeActive(existing.purpose, !existing.active, existing.id);

  const instance = await prisma.whatsAppInstance.update({ where: { id: existing.id }, data: { active: !existing.active } });
  await logAudit(req.user!.sub, "toggle", "WhatsAppInstance", instance.id, { active: instance.active });
  res.json(serializeInstance(instance));
});

settingsRouter.delete("/whatsapp-instances/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.whatsAppInstance.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.sub, "delete", "WhatsAppInstance", req.params.id);
  res.status(204).send();
});

async function credentialsForInstance(id: string): Promise<InstanceCredentials> {
  const instance = await prisma.whatsAppInstance.findUnique({ where: { id } });
  if (!instance) throw new AppError("Instancia nao encontrada", 404);
  return {
    instanceId: instance.id,
    instanceName: instance.instanceName,
    apiUrl: instance.apiUrl || env.evolutionApiUrl,
    apiKey: instance.apiKey || env.evolutionApiKey,
  };
}

settingsRouter.get("/whatsapp-instances/:id/status", requireRole("ADMIN"), async (req, res) => {
  const credentials = await credentialsForInstance(req.params.id);
  const state = await getConnectionState(credentials);
  res.json({ state: state?.state ?? "not_configured" });
});

settingsRouter.get("/whatsapp-instances/:id/qrcode", requireRole("ADMIN"), async (req, res) => {
  const credentials = await credentialsForInstance(req.params.id);
  const qr = await getQrCode(credentials);
  res.json(qr ?? { base64: null });
});
