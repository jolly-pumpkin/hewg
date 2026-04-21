
import { loadConfig } from "./config.ts"
import type { AppConfig } from "./types.ts"

export function showStatus(configPath: string): string {
  const config: AppConfig = loadConfig(configPath)
  return `Status: port=${config.port} connections=${config.maxConnections} log=${config.logLevel}`
}
