import { Router } from "express";
import { env } from "../../config/env";
import { authenticate, requireRole } from "../../middlewares/auth";
import { getConnectionState, getQrCode } from "../../services/evolution";

export const settingsRouter = Router();
settingsRouter.use(authenticate);

settingsRouter.get("/evolution/status", requireRole("ADMIN"), async (_req, res) => {
  const state = await getConnectionState();
  res.json({
    configured: Boolean(env.evolutionApiUrl && env.evolutionInstanceName),
    instanceName: env.evolutionInstanceName,
    state: state?.state ?? "not_configured",
  });
});

settingsRouter.get("/evolution/qrcode", requireRole("ADMIN"), async (_req, res) => {
  const qr = await getQrCode();
  res.json(qr ?? { base64: null });
});
