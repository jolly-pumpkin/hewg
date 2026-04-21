
import { loadConfig } from "./config.ts"
import type { AppConfig } from "./types.ts"

/**
 * Print the current config for the CLI status command.
 * @param configPath - path to the config file
 * @returns formatted status string
 */
export function showStatus(configPath: string): string {
  const config: AppConfig = loadConfig(configPath)
  return `Status: port=${config.port} connections=${config.maxConnections} log=${config.logLevel}`
}
