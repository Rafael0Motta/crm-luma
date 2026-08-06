import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../middlewares/errorHandler";
import { authenticate } from "../../middlewares/auth";
import { logAudit } from "../../services/auditLog";

export const authRouter = Router();

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente em alguns minutos." },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
}

function signAccessToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role } satisfies AccessTokenPayload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "refresh" } satisfies RefreshTokenPayload, env.jwtSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  } as jwt.SignOptions);
}

authRouter.post("/login", loginRateLimit, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email }, include: { plan: true } });
  if (!user || !user.active) {
    throw new AppError("Credenciais invalidas", 401);
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new AppError("Credenciais invalidas", 401);
  }

  await logAudit(user.id, "login", "User", user.id);

  res.json({
    token: signAccessToken(user),
    refreshToken: signRefreshToken(user.id),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan ? { id: user.plan.id, name: user.plan.name } : null,
    },
  });
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);

  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.jwtSecret) as RefreshTokenPayload;
  } catch {
    throw new AppError("Refresh token invalido ou expirado", 401);
  }
  if (payload.type !== "refresh") {
    throw new AppError("Token invalido", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) {
    throw new AppError("Usuario nao encontrado ou inativo", 401);
  }

  res.json({
    token: signAccessToken(user),
    refreshToken: signRefreshToken(user.id),
  });
});

authRouter.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    include: { plan: true },
  });
  if (!user) throw new AppError("Usuario nao encontrado", 404);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    plan: user.plan,
  });
});
