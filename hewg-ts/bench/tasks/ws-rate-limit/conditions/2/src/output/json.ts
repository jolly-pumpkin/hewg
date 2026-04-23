
import type { DailySummary } from "../types.ts"

/**
 * Write daily summaries to a JSON file.
 */
export function writeJson(path: string, summaries: DailySummary[]): void {
  Bun.write(path, JSON.stringify(summaries, null, 2) + "\n")
}
