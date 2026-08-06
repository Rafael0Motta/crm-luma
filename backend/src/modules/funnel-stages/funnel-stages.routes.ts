import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";

export const funnelStagesRouter = Router();
funnelStagesRouter.use(authenticate);

const stageSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().optional(),
  color: z.string().min(1).optional(),
});

funnelStagesRouter.get("/", async (_req, res) => {
  const stages = await prisma.funnelStage.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { clients: true } } },
  });
  res.json(stages);
});

funnelStagesRouter.post("/", async (req, res) => {
  const data = stageSchema.parse(req.body);
  if (data.order === undefined) {
    const max = await prisma.funnelStage.aggregate({ _max: { order: true } });
    data.order = (max._max.order ?? -1) + 1;
  }
  const stage = await prisma.funnelStage.create({ data: { ...data, order: data.order! } });
  res.status(201).json(stage);
});

funnelStagesRouter.put("/:id", async (req, res) => {
  const data = stageSchema.partial().parse(req.body);
  const stage = await prisma.funnelStage.update({ where: { id: req.params.id }, data });
  res.json(stage);
});

funnelStagesRouter.put("/reorder/bulk", async (req, res) => {
  const items = z.array(z.object({ id: z.string(), order: z.number().int() })).parse(req.body);
  await prisma.$transaction(items.map((item) => prisma.funnelStage.update({ where: { id: item.id }, data: { order: item.order } })));
  const stages = await prisma.funnelStage.findMany({ orderBy: { order: "asc" } });
  res.json(stages);
});

funnelStagesRouter.delete("/:id", async (req, res) => {
  await prisma.funnelStage.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
