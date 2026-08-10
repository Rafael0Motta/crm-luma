import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { runAutomationsForEvent } from "../../services/automationEngine";
import { logAudit } from "../../services/auditLog";
import { parseCsv, toCsv } from "../../services/csv";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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
};

function serializeClient(client: any) {
  return { ...client, tags: client.tags?.map((t: any) => t.tag) ?? [] };
}

function buildClientWhere(query: Record<string, string | undefined>): Prisma.ClientWhereInput {
  const { tagId, funnelStageId, assignedUserId, search } = query;
  return {
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
}

clientsRouter.get("/", async (req, res) => {
  const { page, pageSize } = req.query as Record<string, string | undefined>;
  const where = buildClientWhere(req.query as Record<string, string | undefined>);

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

clientsRouter.get("/ids", async (req, res) => {
  const where = buildClientWhere(req.query as Record<string, string | undefined>);
  const clients = await prisma.client.findMany({ where, select: { id: true } });
  res.json(clients.map((c) => c.id));
});

clientsRouter.get("/export", async (req, res) => {
  const { ids } = req.query as Record<string, string | undefined>;
  const where: Prisma.ClientWhereInput = ids
    ? { id: { in: ids.split(",").filter(Boolean) } }
    : buildClientWhere(req.query as Record<string, string | undefined>);

  const clients = await prisma.client.findMany({
    where,
    include: CLIENT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  const headers = ["nome", "telefone", "email", "documento", "etapa", "etiquetas", "atendente"];
  const rows = clients.map((c) => [
    c.name,
    c.phone,
    c.email ?? "",
    c.document ?? "",
    c.funnelStage?.name ?? "",
    c.tags.map((t: any) => t.tag.name).join("; "),
    c.assignedUser?.name ?? "",
  ]);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="clientes-${Date.now()}.csv"`);
  res.send(toCsv(headers, rows));
});

clientsRouter.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) throw new AppError("Nenhum arquivo enviado", 422);

  const text = req.file.buffer.toString("utf-8");
  const allRows = parseCsv(text);
  if (allRows.length === 0) throw new AppError("Arquivo CSV vazio", 422);

  const [headerRow, ...dataRows] = allRows;
  const headers = headerRow.map((h) => h.trim().toLowerCase());
  const colIndex = (name: string) => headers.indexOf(name);

  const nameIdx = colIndex("nome");
  const phoneIdx = colIndex("telefone");
  const emailIdx = colIndex("email");
  const documentIdx = colIndex("documento");
  const stageIdx = colIndex("etapa");
  const tagsIdx = colIndex("etiquetas");

  if (nameIdx === -1 || phoneIdx === -1) {
    throw new AppError("O CSV precisa ter ao menos as colunas 'nome' e 'telefone'", 422);
  }

  const stages = await prisma.funnelStage.findMany();
  const stageByName = new Map(stages.map((s) => [s.name.trim().toLowerCase(), s]));

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const [i, row] of dataRows.entries()) {
    const name = row[nameIdx]?.trim();
    const phone = row[phoneIdx]?.replace(/\D/g, "");
    if (!name || !phone) {
      errors.push(`Linha ${i + 2}: nome ou telefone ausente`);
      continue;
    }

    const email = emailIdx !== -1 ? row[emailIdx]?.trim() || undefined : undefined;
    const document = documentIdx !== -1 ? row[documentIdx]?.trim() || undefined : undefined;
    const stageName = stageIdx !== -1 ? row[stageIdx]?.trim().toLowerCase() : undefined;
    const funnelStageId = stageName ? stageByName.get(stageName)?.id : undefined;
    const tagNames =
      tagsIdx !== -1
        ? row[tagsIdx]
            ?.split(";")
            .map((t) => t.trim())
            .filter(Boolean) ?? []
        : [];

    try {
      const existing = await prisma.client.findUnique({ where: { phone } });
      let client;
      if (existing) {
        client = await prisma.client.update({
          where: { id: existing.id },
          data: { name, email, document, ...(funnelStageId ? { funnelStageId } : {}) },
        });
        updated++;
      } else {
        client = await prisma.client.create({ data: { name, phone, email, document, funnelStageId } });
        created++;
      }

      for (const tagName of tagNames) {
        const tag = await prisma.tag.upsert({
          where: { name: tagName },
          create: { name: tagName },
          update: {},
        });
        await prisma.clientTag.upsert({
          where: { clientId_tagId: { clientId: client.id, tagId: tag.id } },
          create: { clientId: client.id, tagId: tag.id },
          update: {},
        });
      }
    } catch (err: any) {
      errors.push(`Linha ${i + 2}: ${err.message ?? "erro desconhecido"}`);
    }
  }

  await logAudit(req.user!.sub, "import", "Client", null, { created, updated, errors: errors.length });
  res.json({ created, updated, errors });
});

clientsRouter.post("/bulk-delete", async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(req.body);
  const result = await prisma.client.deleteMany({ where: { id: { in: ids } } });
  await logAudit(req.user!.sub, "bulk_delete", "Client", null, { count: result.count });
  res.json({ deleted: result.count });
});

clientsRouter.post("/bulk-tag", async (req, res) => {
  const { ids, tagId, action } = z
    .object({ ids: z.array(z.string()).min(1), tagId: z.string(), action: z.enum(["add", "remove"]) })
    .parse(req.body);

  if (action === "add") {
    await prisma.clientTag.createMany({
      data: ids.map((clientId) => ({ clientId, tagId })),
      skipDuplicates: true,
    });
  } else {
    await prisma.clientTag.deleteMany({ where: { clientId: { in: ids }, tagId } });
  }

  await logAudit(req.user!.sub, "bulk_tag", "Client", null, { count: ids.length, tagId, action });
  res.json({ updated: ids.length });
});

clientsRouter.post("/bulk-stage", async (req, res) => {
  const { ids, funnelStageId } = z.object({ ids: z.array(z.string()).min(1), funnelStageId: z.string() }).parse(req.body);
  const result = await prisma.client.updateMany({ where: { id: { in: ids } }, data: { funnelStageId } });
  await logAudit(req.user!.sub, "bulk_stage_change", "Client", null, { count: result.count, funnelStageId });
  res.json({ updated: result.count });
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
