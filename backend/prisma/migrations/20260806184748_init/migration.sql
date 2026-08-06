-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ATENDENTE');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('ATIVA', 'CANCELADA', 'INADIMPLENTE', 'VENCIDA');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ABERTA', 'PENDENTE', 'RESOLVIDA');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'TEMPLATE', 'VIDEO');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('HUMAN', 'AI', 'AUTOMATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FollowUpRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'STOPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "ScheduledMessageStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ScheduledMessageRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "BillingReminderLogStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxUsers" INTEGER NOT NULL DEFAULT 1,
    "max_conversations_month" INTEGER,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ATENDENTE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "plan_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "document" TEXT,
    "address" JSONB,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "funnel_stage_id" TEXT,
    "assigned_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "insurance_type" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "policy_number" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "due_day" INTEGER NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'ATIVA',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0B5D5B',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_tags" (
    "client_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "client_tags_pkey" PRIMARY KEY ("client_id","tag_id")
);

-- CreateTable
CREATE TABLE "funnel_stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#0B5D5B',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnel_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "whatsapp_number" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ABERTA',
    "assigned_user_id" TEXT,
    "last_message_at" TIMESTAMP(3),
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "media_url" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "sender" "MessageSender" NOT NULL DEFAULT 'HUMAN',
    "sender_user_id" TEXT,
    "evolution_message_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "trigger_config" JSONB NOT NULL DEFAULT '{}',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "stop_condition" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_runs" (
    "id" TEXT NOT NULL,
    "follow_up_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "status" "FollowUpRunStatus" NOT NULL DEFAULT 'RUNNING',
    "next_run_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_config" JSONB NOT NULL DEFAULT '{}',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledMessageStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_message_recipients" (
    "id" TEXT NOT NULL,
    "scheduled_message_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "status" "ScheduledMessageRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "scheduled_message_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_reminders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "policy_id" TEXT,
    "client_id" TEXT,
    "due_day" INTEGER,
    "days_offset" INTEGER NOT NULL,
    "message_template" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_reminder_logs" (
    "id" TEXT NOT NULL,
    "billing_reminder_id" TEXT NOT NULL,
    "status" "BillingReminderLogStatus" NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "base_url" TEXT,
    "system_prompt" TEXT NOT NULL,
    "temperature" DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 1024,
    "allowed_automation_ids" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_phone_key" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "clients_funnel_stage_id_idx" ON "clients"("funnel_stage_id");

-- CreateIndex
CREATE INDEX "clients_assigned_user_id_idx" ON "clients"("assigned_user_id");

-- CreateIndex
CREATE INDEX "policies_client_id_idx" ON "policies"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "conversations_client_id_idx" ON "conversations"("client_id");

-- CreateIndex
CREATE INDEX "conversations_assigned_user_id_idx" ON "conversations"("assigned_user_id");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_evolution_message_id_idx" ON "messages"("evolution_message_id");

-- CreateIndex
CREATE INDEX "follow_up_runs_follow_up_id_idx" ON "follow_up_runs"("follow_up_id");

-- CreateIndex
CREATE INDEX "follow_up_runs_client_id_idx" ON "follow_up_runs"("client_id");

-- CreateIndex
CREATE INDEX "follow_up_runs_status_idx" ON "follow_up_runs"("status");

-- CreateIndex
CREATE INDEX "scheduled_message_recipients_scheduled_message_id_idx" ON "scheduled_message_recipients"("scheduled_message_id");

-- CreateIndex
CREATE INDEX "scheduled_message_recipients_client_id_idx" ON "scheduled_message_recipients"("client_id");

-- CreateIndex
CREATE INDEX "billing_reminders_policy_id_idx" ON "billing_reminders"("policy_id");

-- CreateIndex
CREATE INDEX "billing_reminders_client_id_idx" ON "billing_reminders"("client_id");

-- CreateIndex
CREATE INDEX "billing_reminder_logs_billing_reminder_id_idx" ON "billing_reminder_logs"("billing_reminder_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_funnel_stage_id_fkey" FOREIGN KEY ("funnel_stage_id") REFERENCES "funnel_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tags" ADD CONSTRAINT "client_tags_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tags" ADD CONSTRAINT "client_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_runs" ADD CONSTRAINT "follow_up_runs_follow_up_id_fkey" FOREIGN KEY ("follow_up_id") REFERENCES "follow_ups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_runs" ADD CONSTRAINT "follow_up_runs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_runs" ADD CONSTRAINT "follow_up_runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_message_recipients" ADD CONSTRAINT "scheduled_message_recipients_scheduled_message_id_fkey" FOREIGN KEY ("scheduled_message_id") REFERENCES "scheduled_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_message_recipients" ADD CONSTRAINT "scheduled_message_recipients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_reminders" ADD CONSTRAINT "billing_reminders_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_reminders" ADD CONSTRAINT "billing_reminders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_reminder_logs" ADD CONSTRAINT "billing_reminder_logs_billing_reminder_id_fkey" FOREIGN KEY ("billing_reminder_id") REFERENCES "billing_reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
