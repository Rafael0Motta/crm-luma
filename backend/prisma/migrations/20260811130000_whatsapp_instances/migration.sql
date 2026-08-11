-- CreateEnum
CREATE TYPE "WhatsAppInstancePurpose" AS ENUM ('ATENDIMENTO', 'FOLLOWUP', 'COBRANCA');

-- CreateTable
CREATE TABLE "whatsapp_instances" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "instance_name" TEXT NOT NULL,
    "api_url" TEXT,
    "api_key" TEXT,
    "purpose" "WhatsAppInstancePurpose" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_instances_instance_name_key" ON "whatsapp_instances"("instance_name");

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "instance_id" TEXT;

-- CreateIndex
CREATE INDEX "messages_instance_id_idx" ON "messages"("instance_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "whatsapp_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
