import { PrismaClient } from "@prisma/client";
import { env } from "./env";

export const prisma = new PrismaClient({
  log: env.nodeEnv === "production" ? ["error", "warn"] : ["error", "warn"],
});
