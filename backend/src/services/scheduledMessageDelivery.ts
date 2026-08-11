import { prisma } from "../config/prisma";
import { sendTextMessage, SendTextResult } from "./evolution";
import { resolveInstanceByPurpose } from "./whatsappInstances";
import { findOrCreateOpenConversation } from "./conversationHelper";
import { publishEvent } from "./eventBus";

export async function deliverScheduledMessageToRecipient(
  recipientId: string,
  client: { id: string; phone: string },
  content: string
): Promise<boolean> {
  const instance = await resolveInstanceByPurpose("ATENDIMENTO");
  const result: SendTextResult = instance
    ? await sendTextMessage(instance, client.phone, content)
    : { success: false, errorMessage: "Evolution API nao configurada" };

  await prisma.scheduledMessageRecipient.update({
    where: { id: recipientId },
    data: {
      status: result.success ? "SENT" : "FAILED",
      errorMessage: result.errorMessage,
      sentAt: result.success ? new Date() : null,
    },
  });

  const conversation = await findOrCreateOpenConversation(client.id, client.phone);
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      type: "TEXT",
      content,
      status: result.success ? "SENT" : "FAILED",
      sender: "AUTOMATION",
      evolutionMessageId: result.evolutionMessageId,
      errorMessage: result.errorMessage,
      instanceId: instance?.instanceId ?? undefined,
    },
  });
  await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
  await publishEvent({ type: "message", conversationId: conversation.id, message });

  return result.success;
}
