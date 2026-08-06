import { logger } from "../config/logger";
import { scheduleRepeatableJobs } from "./queues";
import "./followUpWorker";
import "./scheduledMessageWorker";
import "./billingReminderWorker";

scheduleRepeatableJobs()
  .then(() => logger.info("Jobs recorrentes agendados (follow-ups, mensagens agendadas, lembretes de cobranca)"))
  .catch((err) => logger.error({ err }, "Falha ao agendar jobs recorrentes"));

logger.info("Workers do CRM Luma em execucao");
