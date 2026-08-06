import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { authenticate } from "../../middlewares/auth";

export const tagsRouter = Router();
tagsRouter.use(authenticate);

const tagSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1).optional(),
});

tagsRouter.get("/", async (_req, res) => {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { clients: true } } } });
  res.json(tags);
});

tagsRouter.post("/", async (req, res) => {
  const data = tagSchema.parse(req.body);
  const tag = await prisma.tag.create({ data });
  res.status(201).json(tag);
});

tagsRouter.put("/:id", async (req, res) => {
  const data = tagSchema.partial().parse(req.body);
  const tag = await prisma.tag.update({ where: { id: req.params.id }, data });
  res.json(tag);
});

tagsRouter.delete("/:id", async (req, res) => {
  await prisma.tag.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
