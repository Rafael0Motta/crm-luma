import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";

async function main() {
  const plan = await prisma.plan.upsert({
    where: { id: "seed-plan-starter" },
    update: {},
    create: {
      id: "seed-plan-starter",
      name: "Starter",
      maxUsers: 5,
      maxConversationsMo: 1000,
      price: 0,
      features: { automations: true, followUps: true, aiIntegration: true },
    },
  });

  const stages = [
    { name: "Novo Lead", order: 0, color: "#1B4B4A" },
    { name: "Em Contato", order: 1, color: "#2A6F6D" },
    { name: "Proposta Enviada", order: 2, color: "#C9A24B" },
    { name: "Cliente Ativo", order: 3, color: "#1B7A4C" },
    { name: "Perdido", order: 4, color: "#8A2B2B" },
  ];

  for (const stage of stages) {
    const existing = await prisma.funnelStage.findFirst({ where: { name: stage.name } });
    if (!existing) {
      await prisma.funnelStage.create({ data: stage });
    }
  }

  const adminEmail = "admin@lumabeneficios.com.br";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("TrocarSenha123!", 10);
    await prisma.user.create({
      data: {
        name: "Administrador",
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
        planId: plan.id,
      },
    });
    console.log(`Usuario admin criado: ${adminEmail} / senha: TrocarSenha123! (troque no primeiro acesso)`);
  }

  console.log("Seed concluido.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
