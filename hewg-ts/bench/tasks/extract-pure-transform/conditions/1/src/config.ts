
import { readFileSync } from "node:fs"
import type { ReportConfig } from "./types.ts"

export function loadConfig(path: string): ReportConfig {
  const raw = readFileSync(path, "utf8")
  return JSON.parse(raw) as ReportConfig
}
