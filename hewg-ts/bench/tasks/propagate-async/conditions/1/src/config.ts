
import { readFileSync } from "node:fs"
import type { AppConfig } from "./types.ts"

export function loadConfig(path: string): AppConfig {
  const raw = readFileSync(path, "utf8")
  return JSON.parse(raw) as AppConfig
}
