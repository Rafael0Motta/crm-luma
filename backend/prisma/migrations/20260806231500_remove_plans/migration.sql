-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_plan_id_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "plan_id";

-- DropTable
DROP TABLE "plans";

