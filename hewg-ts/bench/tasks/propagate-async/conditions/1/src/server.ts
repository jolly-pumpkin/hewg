
import { loadConfig } from "./config.ts"
import type { AppConfig } from "./types.ts"

export function initServer(configPath: string): string {
  const config: AppConfig = loadConfig(configPath)
  return `Server on port ${config.port}, db=${config.dbUrl}, log=${config.logLevel}`
}
