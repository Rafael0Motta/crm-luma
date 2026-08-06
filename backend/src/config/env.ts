import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3333),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  encryptionKey: required("ENCRYPTION_KEY"),
  evolutionApiUrl: process.env.EVOLUTION_API_URL ?? "",
  evolutionApiKey: process.env.EVOLUTION_API_KEY ?? "",
  evolutionInstanceName: process.env.EVOLUTION_INSTANCE_NAME ?? "",
  appBaseUrl: process.env.APP_BASE_URL ?? "",
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((s) => s.trim()),
};
