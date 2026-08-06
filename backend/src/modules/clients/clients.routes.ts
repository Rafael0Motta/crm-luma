import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { runAutomationsForEvent } from "../../services/automationEngine";
import { logAudit } from "../../services/auditLog";

export const clientsRouter = Router();
clientsRouter.use(authenticate);

const clientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8),
  email: z.string().email().optional().nullable(),
  document: z.string().optional().nullable(),
  address: z.record(z.any()).optional().nullable(),
  customFields: z.record(z.any()).optional(),
  funnelStageId: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
});

const CLIENT_INCLUDE = {
  tags: { include: { tag: true } },
  funnelStage: true,
  assignedUser: { select: { id: true, name: true } },
  policies: true,
};

function serializeClient(client: any) {
  return { ...client, tags: client.tags?.map((t: any) => t.tag) ?? [] };
}

clientsRouter.get("/", async (req, res) => {
  const { tagId, funnelStageId, assignedUserId, search, page, pageSize } = req.query as Record<string, string | undefined>;

  const where: Prisma.ClientWhereInput = {
    ...(funnelStageId ? { funnelStageId } : {}),
    ...(assignedUserId ? { assignedUserId } : {}),
    ...(tagId ? { tags: { some: { tagId } } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" } },
            { document: { contains: search } },
          ],
        }
      : {}),
  };

  // page/pageSize sao opcionais: sem eles, retorna a lista completa (usado em selects/dropdowns).
  if (!page) {
    const clients = await prisma.client.findMany({ where, include: CLIENT_INCLUDE, orderBy: { createdAt: "desc" } });
    return res.json(clients.map(serializeClient));
  }

  const pageNum = Math.max(1, Number(page));
  const size = Math.min(100, Math.max(1, Number(pageSize) || 20));

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: CLIENT_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * size,
      take: size,
    }),
    prisma.client.count({ where }),
  ]);

  res.json({ items: clients.map(serializeClient), total, page: pageNum, pageSize: size });
});

clientsRouter.get("/:id", async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      ...CLIENT_INCLUDE,
      conversations: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!client) throw new AppError("Cliente nao encontrado", 404);
  res.json(serializeClient(client));
});

clientsRouter.post("/", async (req, res) => {
  const data = clientSchema.parse(req.body);

  const existing = await prisma.client.findUnique({ where: { phone: data.phone } });
  if (existing) throw new AppError("Ja existe um cliente com este telefone", 409);

  const client = await prisma.client.create({
    data: data as Prisma.ClientUncheckedCreateInput,
    include: CLIENT_INCLUDE,
  });
  await logAudit(req.user!.sub, "create", "Client", client.id, { name: client.name });
  res.status(201).json(serializeClient(client));
});

clientsRouter.put("/:id", async (req, res) => {
  const data = clientSchema.partial().parse(req.body);
  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: data as Prisma.ClientUncheckedUpdateInput,
    include: CLIENT_INCLUDE,
  });
  res.json(serializeClient(client));
});

clientsRouter.delete("/:id", async (req, res) => {
  await prisma.client.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.sub, "delete", "Client", req.params.id);
  res.status(204).send();
});

clientsRouter.put("/:id/funnel-stage", async (req, res) => {
  const { funnelStageId } = z.object({ funnelStageId: z.string() }).parse(req.body);
  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: { funnelStageId },
    include: CLIENT_INCLUDE,
  });

  await logAudit(req.user!.sub, "funnel_stage_changed", "Client", client.id, { funnelStageId });
  await runAutomationsForEvent({ trigger: "funnel_stage_changed", clientId: client.id, funnelStageId });

  res.json(serializeClient(client));
});

clientsRouter.post("/:id/tags", async (req, res) => {
  const { tagId } = z.object({ tagId: z.string() }).parse(req.body);
  await prisma.clientTag.upsert({
    where: { clientId_tagId: { clientId: req.params.id, tagId } },
    create: { clientId: req.params.id, tagId },
    update: {},
  });

  await logAudit(req.user!.sub, "tag_applied", "Client", req.params.id, { tagId });
  await runAutomationsForEvent({ trigger: "tag_applied", clientId: req.params.id, tagId });

  const client = await prisma.client.findUnique({ where: { id: req.params.id }, include: CLIENT_INCLUDE });
  res.json(serializeClient(client));
});

clientsRouter.delete("/:id/tags/:tagId", async (req, res) => {
  await prisma.clientTag.delete({
    where: { clientId_tagId: { clientId: req.params.id, tagId: req.params.tagId } },
  });
  const client = await prisma.client.findUnique({ where: { id: req.params.id }, include: CLIENT_INCLUDE });
  res.json(serializeClient(client));
});

// -------- Apolices --------

const policySchema = z.object({
  insuranceType: z.string().min(1),
  insurer: z.string().min(1),
  policyNumber: z.string().min(1),
  value: z.number().nonnegative(),
  dueDay: z.number().int().min(1).max(31),
  status: z.enum(["ATIVA", "CANCELADA", "INADIMPLENTE", "VENCIDA"]).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

clientsRouter.get("/:id/policies", async (req, res) => {
  const policies = await prisma.policy.findMany({ where: { clientId: req.params.id }, orderBy: { createdAt: "desc" } });
  res.json(policies);
});

clientsRouter.post("/:id/policies", async (req, res) => {
  const data = policySchema.parse(req.body);
  const policy = await prisma.policy.create({ data: { ...data, clientId: req.params.id } });
  res.status(201).json(policy);
});

export const policiesRouter = Router();
policiesRouter.use(authenticate);

policiesRouter.put("/:id", async (req, res) => {
  const data = policySchema.partial().parse(req.body);
  const policy = await prisma.policy.update({ where: { id: req.params.id }, data });
  res.json(policy);
});

policiesRouter.delete("/:id", async (req, res) => {
  await prisma.policy.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
