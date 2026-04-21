/**
 * @hewg-module report/config
 */

import { readFileSync } from "node:fs"
import type { ReportConfig } from "./types.ts"

/**
 * Load report configuration from disk.
 * @param path - path to config JSON file
 * @returns the parsed config
 * @effects fs.read
 */
export function loadConfig(path: string): ReportConfig {
  const raw = readFileSync(path, "utf8")
  return JSON.parse(raw) as ReportConfig
}
