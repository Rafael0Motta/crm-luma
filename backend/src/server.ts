import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

app.listen(env.port, () => {
  logger.info(`CRM Luma backend rodando na porta ${env.port}`);
});
