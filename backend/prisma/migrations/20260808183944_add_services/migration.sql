-- CreateEnum
CREATE TYPE "ClientServiceStatus" AS ENUM ('ATIVO', 'CANCELADO', 'INADIMPLENTE', 'VENCIDO');

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "price" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_services" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "due_day" INTEGER NOT NULL,
    "payment_date" TIMESTAMP(3),
    "status" "ClientServiceStatus" NOT NULL DEFAULT 'ATIVO',
    "start_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_services_client_id_idx" ON "client_services"("client_id");

-- CreateIndex
CREATE INDEX "client_services_service_id_idx" ON "client_services"("service_id");

-- AddForeignKey
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
