import { prisma } from "../config/prisma";

export async function findOrCreateOpenConversation(clientId: string, whatsappNumber: string) {
  let conversation = await prisma.conversation.findFirst({
    where: { clientId, status: { in: ["ABERTA", "PENDENTE"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { clientId, whatsappNumber, status: "ABERTA" },
    });
  }

  return conversation;
}
