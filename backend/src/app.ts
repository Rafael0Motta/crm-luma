import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { UPLOADS_DIR } from "./services/mediaStorage";

import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { plansRouter } from "./modules/plans/plans.routes";
import { clientsRouter, policiesRouter } from "./modules/clients/clients.routes";
import { tagsRouter } from "./modules/tags/tags.routes";
import { funnelStagesRouter } from "./modules/funnel-stages/funnel-stages.routes";
import { conversationsRouter } from "./modules/conversations/conversations.routes";
import { evolutionWebhookRouter } from "./modules/webhooks/evolution.webhook";
import { automationsRouter } from "./modules/automations/automations.routes";
import { followUpsRouter } from "./modules/followups/followups.routes";
import { scheduledMessagesRouter } from "./modules/scheduled-messages/scheduled-messages.routes";
import { billingRemindersRouter } from "./modules/billing-reminders/billing-reminders.routes";
import { aiSettingsRouter } from "./modules/ai-settings/ai-settings.routes";
import { settingsRouter } from "./modules/settings/settings.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/plans", plansRouter);
app.use("/clients", clientsRouter);
app.use("/policies", policiesRouter);
app.use("/tags", tagsRouter);
app.use("/funnel-stages", funnelStagesRouter);
app.use("/conversations", conversationsRouter);
app.use("/webhooks/evolution", evolutionWebhookRouter);
app.use("/automations", automationsRouter);
app.use("/followups", followUpsRouter);
app.use("/scheduled-messages", scheduledMessagesRouter);
app.use("/billing-reminders", billingRemindersRouter);
app.use("/ai-settings", aiSettingsRouter);
app.use("/settings", settingsRouter);
app.use("/dashboard", dashboardRouter);

app.use(notFoundHandler);
app.use(errorHandler);
