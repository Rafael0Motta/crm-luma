import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { onCrmEvent } from "../../services/eventBus";
import type { AuthPayload } from "../../middlewares/auth";

export const eventsRouter = Router();

eventsRouter.get("/stream", (req, res) => {
  const token = req.query.token;
  if (typeof token !== "string") {
    throw new AppError("Token de autenticacao ausente", 401);
  }
  try {
    jwt.verify(token, env.jwtSecret) as AuthPayload;
  } catch {
    throw new AppError("Token invalido ou expirado", 401);
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": conectado\n\n");

  const unsubscribe = onCrmEvent((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
