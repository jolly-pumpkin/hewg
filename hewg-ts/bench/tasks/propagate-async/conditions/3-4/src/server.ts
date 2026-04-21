/**
 * @hewg-module async/server
 */

import { loadConfig } from "./config.ts"
import type { AppConfig } from "./types.ts"

/**
 * Initialize the server with config loaded from disk.
 * @param configPath - path to the config file
 * @returns a description of the server setup
 * @effects fs.read
 */
export function initServer(configPath: string): string {
  const config: AppConfig = loadConfig(configPath)
  return `Server on port ${config.port}, db=${config.dbUrl}, log=${config.logLevel}`
}
