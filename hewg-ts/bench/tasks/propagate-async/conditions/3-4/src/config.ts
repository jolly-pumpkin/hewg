/**
 * @hewg-module async/config
 */

import { readFileSync } from "node:fs"
import type { AppConfig } from "./types.ts"

/**
 * Load application configuration from a JSON file (synchronous).
 * @param path - path to config JSON
 * @returns parsed config
 * @effects fs.read
 */
export function loadConfig(path: string): AppConfig {
  const raw = readFileSync(path, "utf8")
  return JSON.parse(raw) as AppConfig
}
