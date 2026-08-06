import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import { sendTextMessage } from "./evolution";
import { generateAIReply } from "./aiProvider";
import { publishEvent } from "./eventBus";

export type AutomationTrigger =
  | "new_conversation"
  | "message_received"
  | "funnel_stage_changed"
  | "tag_applied";

export interface AutomationEvent {
  trigger: AutomationTrigger;
  clientId: string;
  conversationId?: string;
  messageContent?: string;
  funnelStageId?: string;
  tagId?: string;
}

export interface Condition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains";
  value: string;
}

interface ActionSendMessage {
  type: "send_message";
  content: string;
}
interface ActionApplyTag {
  type: "apply_tag";
  tagId: string;
}
interface ActionMoveFunnelStage {
  type: "move_funnel_stage";
  funnelStageId: string;
}
interface ActionAssignUser {
  type: "assign_user";
  userId: string;
}
interface ActionTriggerAI {
  type: "trigger_ai";
}
interface ActionNotifyInternal {
  type: "notify_internal";
  message: string;
}

type Action = ActionSendMessage | ActionApplyTag | ActionMoveFunnelStage | ActionAssignUser | ActionTriggerAI | ActionNotifyInternal;

function getFieldValue(field: string, event: AutomationEvent, client: { name: string; phone: string; funnelStageId: string | null }): string {
  switch (field) {
    case "message.content":
      return event.messageContent ?? "";
    case "client.name":
      return client.name;
    case "client.phone":
      return client.phone;
    case "client.funnelStageId":
      return client.funnelStageId ?? "";
    case "tag.id":
      return event.tagId ?? "";
    default:
      return "";
  }
}

export function evaluateConditions(conditions: Condition[], event: AutomationEvent, client: { name: string; phone: string; funnelStageId: string | null }): boolean {
  return conditions.every((condition) => {
    const value = getFieldValue(condition.field, event, client).toLowerCase();
    const target = condition.value.toLowerCase();
    switch (condition.operator) {
      case "equals":
        return value === target;
      case "not_equals":
        return value !== target;
      case "contains":
        return value.includes(target);
      case "not_contains":
        return !value.includes(target);
      default:
        return false;
    }
  });
}

async function executeAction(action: Action, event: AutomationEvent) {
  switch (action.type) {
    case "send_message": {
      const client = await prisma.client.findUnique({ where: { id: event.clientId } });
      if (!client) return;
      const result = await sendTextMessage(client.phone, action.content);
      if (event.conversationId) {
        const sentMessage = await prisma.message.create({
          data: {
            conversationId: event.conversationId,
            direction: "OUTBOUND",
            type: "TEXT",
            content: action.content,
            status: result.success ? "SENT" : "FAILED",
            sender: "AUTOMATION",
            evolutionMessageId: result.evolutionMessageId,
            errorMessage: result.errorMessage,
          },
        });
        await prisma.conversation.update({ where: { id: event.conversationId }, data: { lastMessageAt: new Date() } });
        await publishEvent({ type: "message", conversationId: event.conversationId, message: sentMessage });
      }
      break;
    }
    case "apply_tag":
      await prisma.clientTag.upsert({
        where: { clientId_tagId: { clientId: event.clientId, tagId: action.tagId } },
        create: { clientId: event.clientId, tagId: action.tagId },
        update: {},
      });
      break;
    case "move_funnel_stage":
      await prisma.client.update({ where: { id: event.clientId }, data: { funnelStageId: action.funnelStageId } });
      break;
    case "assign_user":
      await prisma.client.update({ where: { id: event.clientId }, data: { assignedUserId: action.userId } });
      if (event.conversationId) {
        await prisma.conversation.update({ where: { id: event.conversationId }, data: { assignedUserId: action.userId } });
      }
      break;
    case "trigger_ai": {
      if (!event.conversationId) return;
      const conversation = await prisma.conversation.findUnique({ where: { id: event.conversationId } });
      if (!conversation?.aiEnabled) return;
      const history = await prisma.message.findMany({
        where: { conversationId: event.conversationId },
        orderBy: { createdAt: "asc" },
        take: 20,
      });
      const chatHistory = history.map((m) => ({
        role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      }));
      const reply = await generateAIReply(chatHistory);
      if (!reply) return;
      const client = await prisma.client.findUnique({ where: { id: event.clientId } });
      if (!client) return;
      const result = await sendTextMessage(client.phone, reply);
      const aiMessage = await prisma.message.create({
        data: {
          conversationId: event.conversationId,
          direction: "OUTBOUND",
          type: "TEXT",
          content: reply,
          status: result.success ? "SENT" : "FAILED",
          sender: "AI",
          evolutionMessageId: result.evolutionMessageId,
          errorMessage: result.errorMessage,
        },
      });
      await prisma.conversation.update({ where: { id: event.conversationId }, data: { lastMessageAt: new Date() } });
      await publishEvent({ type: "message", conversationId: event.conversationId, message: aiMessage });
      break;
    }
    case "notify_internal":
      logger.info({ event }, `[Notificacao interna] ${action.message}`);
      break;
  }
}

export async function runAutomationsForEvent(event: AutomationEvent): Promise<void> {
  const automations = await prisma.automation.findMany({ where: { trigger: event.trigger, active: true } });
  if (automations.length === 0) return;

  const client = await prisma.client.findUnique({ where: { id: event.clientId } });
  if (!client) return;

  for (const automation of automations) {
    try {
      const conditions = (automation.conditions as unknown as Condition[]) ?? [];
      if (!evaluateConditions(conditions, event, client)) continue;

      const actions = (automation.actions as unknown as Action[]) ?? [];
      for (const action of actions) {
        await executeAction(action, event);
      }
    } catch (err) {
      logger.error({ err, automationId: automation.id }, "Falha ao executar automacao");
    }
  }
}

export async function cancelPendingFollowUpsForClient(clientId: string): Promise<void> {
  await prisma.followUpRun.updateMany({
    where: { clientId, status: "RUNNING" },
    data: { status: "STOPPED" },
  });
}
