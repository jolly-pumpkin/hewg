
import type { AppConfig } from "../types.ts"
import { openDb } from "../db/connection.ts"
import { syncAllStations } from "../services/sync.ts"
import { checkAlerts, formatAlert } from "../services/alerts.ts"
import { getReadings } from "../db/readings.ts"

/**
 * Fetch weather data for all configured stations and store in the database.
 */
export async function runFetch(config: AppConfig, days: number): Promise<void> {
  const db = openDb(config.dbPath)

  console.log(`Fetching ${days}-day forecast for ${config.stations.length} station(s)...`)
  const results = await syncAllStations(db, config.stations, days)

  for (const r of results) {
    if (r.errors.length > 0) {
      console.error(`  [ERROR] ${r.station.name}: ${r.errors.map((e) => e.message).join(", ")}`)
    } else {
      console.log(`  [OK] ${r.station.name}: ${r.readingsCount} readings`)
    }
  }

  const since = new Date()
  since.setDate(since.getDate() - days)
  for (const station of config.stations) {
    const readings = getReadings(db, station.id, since)
    const alerts = checkAlerts(readings, config.alertThresholds)
    for (const alert of alerts) {
      console.log(`  ${formatAlert(alert)}`)
    }
  }

  db.close()
}
