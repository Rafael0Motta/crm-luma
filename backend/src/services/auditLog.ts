import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";

export async function logAudit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { userId, action, entity, entityId: entityId ?? undefined, metadata: metadata as Prisma.InputJsonValue },
    });
  } catch (err) {
    logger.error({ err, action, entity, entityId }, "Falha ao gravar audit log");
  }
}
