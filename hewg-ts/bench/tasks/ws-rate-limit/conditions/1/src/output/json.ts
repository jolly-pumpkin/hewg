
import type { DailySummary } from "../types.ts"

export function writeJson(path: string, summaries: DailySummary[]): void {
  Bun.write(path, JSON.stringify(summaries, null, 2) + "\n")
}
