/*
  Warnings:

  - You are about to drop the `policies` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "policies" DROP CONSTRAINT "policies_client_id_fkey";

-- DropTable
DROP TABLE "policies";

-- DropEnum
DROP TYPE "PolicyStatus";
