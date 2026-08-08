-- AlterTable
ALTER TABLE "billing_reminder_logs" ADD COLUMN     "client_id" TEXT;

-- AlterTable
ALTER TABLE "billing_reminders" ADD COLUMN     "service_id" TEXT;

-- CreateIndex
CREATE INDEX "billing_reminder_logs_client_id_idx" ON "billing_reminder_logs"("client_id");

-- CreateIndex
CREATE INDEX "billing_reminders_service_id_idx" ON "billing_reminders"("service_id");

-- AddForeignKey
ALTER TABLE "billing_reminders" ADD CONSTRAINT "billing_reminders_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_reminder_logs" ADD CONSTRAINT "billing_reminder_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
