/**
 *
 * Environment variable loading for the task queue service.
 */

/**
 * Read process.env and return a typed EnvConfig with defaults applied
 * for any missing variables.
 *
 */
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

/**
 * Parse a string as an integer, returning the default when the value
 * is undefined or not a valid number.
 *
 */
export function parseIntOrDefault(
  value: string | undefined,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
