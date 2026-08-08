import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { logAudit } from "../../services/auditLog";

export const servicesRouter = Router();
servicesRouter.use(authenticate);

const serviceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
  active: z.boolean().optional(),
});

servicesRouter.get("/", async (req, res) => {
  const { search, active } = req.query as Record<string, string | undefined>;
  const services = await prisma.service.findMany({
    where: {
      ...(active !== undefined ? { active: active === "true" } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { name: "asc" },
  });
  res.json(services);
});

servicesRouter.post("/", async (req, res) => {
  const data = serviceSchema.parse(req.body);
  const service = await prisma.service.create({ data });
  await logAudit(req.user!.sub, "create", "Service", service.id, { name: service.name });
  res.status(201).json(service);
});

servicesRouter.put("/:id", async (req, res) => {
  const data = serviceSchema.partial().parse(req.body);
  const service = await prisma.service.update({ where: { id: req.params.id }, data });
  res.json(service);
});

servicesRouter.delete("/:id", async (req, res) => {
  await prisma.service.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.sub, "delete", "Service", req.params.id);
  res.status(204).send();
});

// -------- Vinculos (cliente <-> servico) --------

const subscriptionSchema = z.object({
  clientId: z.string().min(1),
  serviceId: z.string().min(1),
  value: z.number().nonnegative(),
  dueDay: z.number().int().min(1).max(31),
  paymentDate: z.string().datetime().optional().nullable(),
  status: z.enum(["ATIVO", "CANCELADO", "INADIMPLENTE", "VENCIDO"]).optional(),
  startDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const SUBSCRIPTION_INCLUDE = {
  client: { select: { id: true, name: true, phone: true } },
  service: true,
};

servicesRouter.get("/subscriptions", async (req, res) => {
  const { clientId, serviceId, status, search } = req.query as Record<string, string | undefined>;
  const subscriptions = await prisma.clientService.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(serviceId ? { serviceId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(search
        ? {
            OR: [
              { client: { name: { contains: search, mode: "insensitive" } } },
              { service: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: SUBSCRIPTION_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  res.json(subscriptions);
});

servicesRouter.post("/subscriptions", async (req, res) => {
  const data = subscriptionSchema.parse(req.body);
  const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
  if (!service) throw new AppError("Servico nao encontrado", 404);

  const subscription = await prisma.clientService.create({ data, include: SUBSCRIPTION_INCLUDE });
  await logAudit(req.user!.sub, "create", "ClientService", subscription.id, {
    clientId: data.clientId,
    serviceId: data.serviceId,
  });
  res.status(201).json(subscription);
});

servicesRouter.put("/subscriptions/:id", async (req, res) => {
  const data = subscriptionSchema.partial().parse(req.body);
  const subscription = await prisma.clientService.update({
    where: { id: req.params.id },
    data,
    include: SUBSCRIPTION_INCLUDE,
  });
  res.json(subscription);
});

servicesRouter.delete("/subscriptions/:id", async (req, res) => {
  await prisma.clientService.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.sub, "delete", "ClientService", req.params.id);
  res.status(204).send();
});
