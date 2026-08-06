export type UserRole = "ADMIN" | "ATENDENTE";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  _count?: { clients: number };
}

export interface FunnelStage {
  id: string;
  name: string;
  order: number;
  color: string;
  _count?: { clients: number };
}

export interface Policy {
  id: string;
  clientId: string;
  insuranceType: string;
  insurer: string;
  policyNumber: string;
  value: string;
  dueDay: number;
  status: "ATIVA" | "CANCELADA" | "INADIMPLENTE" | "VENCIDA";
  startDate: string | null;
  endDate: string | null;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  document: string | null;
  address: Record<string, unknown> | null;
  customFields: Record<string, unknown>;
  funnelStageId: string | null;
  funnelStage?: FunnelStage | null;
  assignedUserId: string | null;
  assignedUser?: { id: string; name: string } | null;
  tags: Tag[];
  policies?: Policy[];
  createdAt: string;
}

export type ConversationStatus = "ABERTA" | "PENDENTE" | "RESOLVIDA";

export interface Conversation {
  id: string;
  clientId: string;
  client: Client;
  whatsappNumber: string;
  status: ConversationStatus;
  assignedUserId: string | null;
  assignedUser?: { id: string; name: string } | null;
  lastMessageAt: string | null;
  unreadCount: number;
  aiEnabled: boolean;
  createdAt: string;
  lastMessagePreview: {
    content: string;
    type: string;
    direction: "INBOUND" | "OUTBOUND";
    sender: MessageSender;
  } | null;
}

export type MessageSender = "HUMAN" | "AI" | "AUTOMATION" | "SYSTEM";

export interface Message {
  id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  type: "TEXT" | "IMAGE" | "AUDIO" | "DOCUMENT" | "TEMPLATE" | "VIDEO";
  content: string;
  mediaUrl: string | null;
  status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  sender: MessageSender;
  errorMessage: string | null;
  createdAt: string;
}

export type AutomationTrigger = "new_conversation" | "message_received" | "funnel_stage_changed" | "tag_applied";

export interface AutomationCondition {
  field: "message.content" | "client.name" | "client.phone" | "client.funnelStageId";
  operator: "equals" | "not_equals" | "contains" | "not_contains";
  value: string;
}

export type AutomationAction =
  | { type: "send_message"; content: string }
  | { type: "apply_tag"; tagId: string }
  | { type: "move_funnel_stage"; funnelStageId: string }
  | { type: "assign_user"; userId: string }
  | { type: "trigger_ai" }
  | { type: "notify_internal"; message: string };

export interface Automation {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  active: boolean;
  createdAt: string;
}

export interface FollowUpStep {
  message: string;
  delayMinutes: number;
}

export type FollowUpTriggerConfig =
  | { type: "NO_RESPONSE"; hours: number }
  | { type: "STUCK_IN_STAGE"; funnelStageId: string; days: number }
  | { type: "AFTER_TAG"; tagId: string };

export interface FollowUp {
  id: string;
  name: string;
  triggerType: "NO_RESPONSE" | "STUCK_IN_STAGE" | "AFTER_TAG";
  triggerConfig: FollowUpTriggerConfig;
  steps: FollowUpStep[];
  stopCondition: { onReply?: boolean; onFunnelStageChange?: boolean };
  active: boolean;
  _count?: { runs: number };
}

export interface ScheduledMessage {
  id: string;
  name: string;
  content: string;
  targetType: "SINGLE" | "TAG" | "FUNNEL_STAGE" | "ALL";
  targetConfig: Record<string, string>;
  scheduledFor: string;
  status: "PENDING" | "SENDING" | "SENT" | "FAILED" | "PARTIAL";
  _count?: { recipients: number };
}

export interface BillingReminder {
  id: string;
  name: string;
  policyId: string | null;
  clientId: string | null;
  policy?: { id: string; policyNumber: string; client: { id: string; name: string } } | null;
  client?: { id: string; name: string } | null;
  dueDay: number | null;
  daysOffset: number;
  messageTemplate: string;
  channel: string;
  active: boolean;
  _count?: { history: number };
}

export interface AISettings {
  id: string;
  provider: "OPENAI" | "ANTHROPIC" | "CUSTOM";
  model: string;
  baseUrl: string | null;
  systemPrompt: string;
  temperature: string;
  maxTokens: number;
  active: boolean;
  apiKeyMasked: string;
}

export interface FollowUpRun {
  id: string;
  followUpId: string;
  clientId: string;
  client: { id: string; name: string; phone: string };
  currentStep: number;
  status: "RUNNING" | "COMPLETED" | "STOPPED" | "FAILED";
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardMetrics {
  openConversations: number;
  pendingConversations: number;
  newClientsThisMonth: number;
  clientsByStage: { id: string; name: string; color: string; count: number }[];
  responseRate: number;
  billingRemindersFailedThisMonth: number;
}
