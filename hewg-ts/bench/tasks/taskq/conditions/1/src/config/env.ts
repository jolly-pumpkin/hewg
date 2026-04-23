
export interface EnvConfig {
  readonly databasePath: string;
  readonly port: number;
  readonly jwksUrl: string;
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly webhookTimeoutMs: number;
  readonly maxWorkers: number;
  readonly logLevel: string;
}

const DEFAULT_DATABASE_PATH = "./data/taskq.json";
const DEFAULT_PORT = 3000;
const DEFAULT_JWKS_URL = "https://auth.example.com/.well-known/jwks.json";
const DEFAULT_SMTP_HOST = "localhost";
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_WEBHOOK_TIMEOUT_MS = 5000;
const DEFAULT_MAX_WORKERS = 4;
const DEFAULT_LOG_LEVEL = "info";

export function loadEnv(): EnvConfig {
  const env = process.env;

  return {
    databasePath: env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH,
    port: parseIntOrDefault(env.PORT, DEFAULT_PORT),
    jwksUrl: env.JWKS_URL ?? DEFAULT_JWKS_URL,
    smtpHost: env.SMTP_HOST ?? DEFAULT_SMTP_HOST,
    smtpPort: parseIntOrDefault(env.SMTP_PORT, DEFAULT_SMTP_PORT),
    webhookTimeoutMs: parseIntOrDefault(
      env.WEBHOOK_TIMEOUT_MS,
      DEFAULT_WEBHOOK_TIMEOUT_MS,
    ),
    maxWorkers: parseIntOrDefault(env.MAX_WORKERS, DEFAULT_MAX_WORKERS),
    logLevel: env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL,
  };
}

export function parseIntOrDefault(
  value: string | undefined,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
