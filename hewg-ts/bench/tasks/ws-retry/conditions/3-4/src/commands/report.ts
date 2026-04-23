/**
 * @hewg-module weather/commands/report
 */

import type { AppConfig, ReportFormat } from "../types.ts"
import { openDb } from "../db/connection.ts"
import { getReadings } from "../db/readings.ts"
import { listStations } from "../db/stations.ts"
import { computeDailySummaries, computeStationStats } from "../services/analytics.ts"
import { renderTable } from "../output/table.ts"
import { writeCsv } from "../output/csv.ts"
import { writeJson } from "../output/json.ts"

/**
 * Generate a weather report from stored data.
 * @effects fs.read, fs.write, log
 */
export async function runReport(
  config: AppConfig,
  opts: { format: ReportFormat; days: number; stationId?: string; outPath?: string },
): Promise<void> {
  const db = openDb(config.dbPath)
  const since = new Date()
  since.setDate(since.getDate() - opts.days)

  const stations = opts.stationId
    ? [{ id: opts.stationId }]
    : listStations(db)

  for (const { id } of stations) {
    const readings = getReadings(db, id, since)
    if (readings.length === 0) {
      console.log(`No readings for station ${id}`)
      continue
    }

    const summaries = computeDailySummaries(readings)
    const stats = computeStationStats(summaries)

    console.log(`\n--- Station: ${id} (${summaries.length} days) ---`)
    console.log(`  Temp range: ${stats.minTemp.toFixed(1)}C to ${stats.maxTemp.toFixed(1)}C (avg ${stats.avgTemp.toFixed(1)}C)`)
    console.log(`  Total precip: ${stats.totalPrecip.toFixed(1)}mm, avg wind: ${stats.avgWind.toFixed(1)}km/h`)

    switch (opts.format) {
      case "table":
        console.log(renderTable(summaries))
        break
      case "csv": {
        const path = opts.outPath ?? `report-${id}.csv`
        writeCsv(path, summaries)
        console.log(`  Written to ${path}`)
        break
      }
      case "json": {
        const path = opts.outPath ?? `report-${id}.json`
        writeJson(path, summaries)
        console.log(`  Written to ${path}`)
        break
      }
    }
  }

  db.close()
}
