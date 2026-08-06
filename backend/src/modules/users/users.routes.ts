import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { authenticate, requireRole } from "../../middlewares/auth";
import { AppError } from "../../middlewares/errorHandler";
import { logAudit } from "../../services/auditLog";

export const usersRouter = Router();
usersRouter.use(authenticate);

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole).optional(),
  planId: z.string().optional(),
  active: z.boolean().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(UserRole).optional(),
  planId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

function serialize(user: { id: string; name: string; email: string; role: UserRole; active: boolean; planId: string | null; createdAt: Date }) {
  const { ...rest } = user;
  return rest;
}

usersRouter.get("/", requireRole("ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, planId: true, createdAt: true, plan: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

usersRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const data = createUserSchema.parse(req.body);

  if (data.planId) {
    const plan = await prisma.plan.findUnique({ where: { id: data.planId } });
    if (!plan) throw new AppError("Plano nao encontrado", 404);

    const currentUsers = await prisma.user.count({ where: { planId: data.planId } });
    if (currentUsers >= plan.maxUsers) {
      throw new AppError(`O plano "${plan.name}" atingiu o limite de ${plan.maxUsers} usuarios`, 422);
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError("Ja existe um usuario com este e-mail", 409);

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role ?? "ATENDENTE",
      planId: data.planId,
      active: data.active ?? true,
    },
  });

  await logAudit(req.user!.sub, "create", "User", user.id, { email: user.email, role: user.role });
  res.status(201).json(serialize(user));
});

usersRouter.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const data = updateUserSchema.parse(req.body);

  if (data.planId) {
    const plan = await prisma.plan.findUnique({ where: { id: data.planId } });
    if (!plan) throw new AppError("Plano nao encontrado", 404);

    const currentUsers = await prisma.user.count({ where: { planId: data.planId, id: { not: req.params.id } } });
    if (currentUsers >= plan.maxUsers) {
      throw new AppError(`O plano "${plan.name}" atingiu o limite de ${plan.maxUsers} usuarios`, 422);
    }
  }

  const { password, ...rest } = data;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });

  await logAudit(req.user!.sub, "update", "User", user.id, { fields: Object.keys(rest) });
  res.json(serialize(user));
});

usersRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  if (req.user!.sub === req.params.id) {
    throw new AppError("Voce nao pode excluir seu proprio usuario", 400);
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.sub, "delete", "User", req.params.id);
  res.status(204).send();
});
