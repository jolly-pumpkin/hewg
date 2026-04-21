
import { loadConfig } from "./config.ts"
import type { AppConfig } from "./types.ts"

export function runMigrations(configPath: string): string {
  const config: AppConfig = loadConfig(configPath)
  return `Migrating database at ${config.dbUrl} with max ${config.maxConnections} connections`
}
