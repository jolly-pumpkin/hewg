/**
 * @hewg-module weather/output/json
 */

import type { DailySummary } from "../types.ts"

/**
 * Write daily summaries to a JSON file.
 * @effects fs.write
 * @cap out fs.write
 */
export function writeJson(path: string, summaries: DailySummary[]): void {
  Bun.write(path, JSON.stringify(summaries, null, 2) + "\n")
}
