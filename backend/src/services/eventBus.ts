import { EventEmitter } from "node:events";
import IORedis from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

const CHANNEL = "crm:events";

export interface CrmEvent {
  type: "message" | "conversation_updated";
  conversationId: string;
  message?: unknown;
}

const localEmitter = new EventEmitter();
localEmitter.setMaxListeners(0);

const publisher = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
const subscriber = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

subscriber.subscribe(CHANNEL).catch((err) => logger.error({ err }, "Falha ao inscrever no canal de eventos"));

subscriber.on("message", (_channel, raw) => {
  try {
    const event = JSON.parse(raw) as CrmEvent;
    localEmitter.emit("event", event);
  } catch (err) {
    logger.error({ err }, "Falha ao processar evento recebido via Redis pub/sub");
  }
});

export async function publishEvent(event: CrmEvent): Promise<void> {
  try {
    await publisher.publish(CHANNEL, JSON.stringify(event));
  } catch (err) {
    logger.error({ err, event }, "Falha ao publicar evento");
  }
}

export function onCrmEvent(listener: (event: CrmEvent) => void): () => void {
  localEmitter.on("event", listener);
  return () => localEmitter.off("event", listener);
}
