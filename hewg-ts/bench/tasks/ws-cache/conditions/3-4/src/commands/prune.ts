/**
 * @hewg-module weather/commands/prune
 */

import type { AppConfig } from "../types.ts"
import { openDb } from "../db/connection.ts"
import { deleteOlderThan } from "../db/readings.ts"

/**
 * Delete weather readings older than the specified number of days.
 * @effects fs.read, fs.write, log
 */
export async function runPrune(config: AppConfig, olderThanDays: number): Promise<void> {
  const db = openDb(config.dbPath)

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  const deleted = deleteOlderThan(db, cutoff)
  console.log(`Pruned ${deleted} reading(s) older than ${olderThanDays} days`)

  db.close()
}
