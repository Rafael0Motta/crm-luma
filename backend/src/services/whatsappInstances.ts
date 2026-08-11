import { WhatsAppInstancePurpose } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

export interface InstanceCredentials {
  instanceId: string | null;
  instanceName: string;
  apiUrl: string;
  apiKey: string;
}

function fallbackFromEnv(): InstanceCredentials | null {
  if (!env.evolutionApiUrl || !env.evolutionInstanceName) return null;
  return {
    instanceId: null,
    instanceName: env.evolutionInstanceName,
    apiUrl: env.evolutionApiUrl,
    apiKey: env.evolutionApiKey,
  };
}

// Se nao houver instancia cadastrada para o proposito, cai na config global
// (EVOLUTION_API_URL/KEY/INSTANCE_NAME) - preserva o comportamento de instalacoes
// que nao configuraram multiplas instancias.
export async function resolveInstanceByPurpose(purpose: WhatsAppInstancePurpose): Promise<InstanceCredentials | null> {
  const instance = await prisma.whatsAppInstance.findFirst({ where: { purpose, active: true } });
  if (!instance) return fallbackFromEnv();

  return {
    instanceId: instance.id,
    instanceName: instance.instanceName,
    apiUrl: instance.apiUrl || env.evolutionApiUrl,
    apiKey: instance.apiKey || env.evolutionApiKey,
  };
}

export async function resolveInstanceByName(instanceName: string): Promise<InstanceCredentials | null> {
  const instance = await prisma.whatsAppInstance.findUnique({ where: { instanceName } });
  if (instance) {
    return {
      instanceId: instance.id,
      instanceName: instance.instanceName,
      apiUrl: instance.apiUrl || env.evolutionApiUrl,
      apiKey: instance.apiKey || env.evolutionApiKey,
    };
  }

  const fallback = fallbackFromEnv();
  return fallback && fallback.instanceName === instanceName ? fallback : null;
}
