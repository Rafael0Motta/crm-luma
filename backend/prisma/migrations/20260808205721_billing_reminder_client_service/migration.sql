/*
  Warnings:

  - You are about to drop the column `policy_id` on the `billing_reminders` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "billing_reminders" DROP CONSTRAINT "billing_reminders_policy_id_fkey";

-- DropIndex
DROP INDEX "billing_reminders_policy_id_idx";

-- AlterTable
ALTER TABLE "billing_reminders" DROP COLUMN "policy_id",
ADD COLUMN     "client_service_id" TEXT;

-- CreateIndex
CREATE INDEX "billing_reminders_client_service_id_idx" ON "billing_reminders"("client_service_id");

-- AddForeignKey
ALTER TABLE "billing_reminders" ADD CONSTRAINT "billing_reminders_client_service_id_fkey" FOREIGN KEY ("client_service_id") REFERENCES "client_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
