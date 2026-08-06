import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: "Dados invalidos",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  logger.error({ err, path: req.path, method: req.method }, "Erro nao tratado");
  return res.status(500).json({ error: "Erro interno do servidor" });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Rota nao encontrada: ${req.method} ${req.path}` });
}
