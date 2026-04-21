
import { loadConfig } from "./config.ts"
import type { AppConfig } from "./types.ts"

/**
 * Run database migrations using the configured DB URL.
 * @param configPath - path to the config file
 * @returns migration result description
 */
export function runMigrations(configPath: string): string {
  const config: AppConfig = loadConfig(configPath)
  return `Migrating database at ${config.dbUrl} with max ${config.maxConnections} connections`
}
