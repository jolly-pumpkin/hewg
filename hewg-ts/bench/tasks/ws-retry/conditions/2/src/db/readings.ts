
import type { Database } from "bun:sqlite"
import type { Reading } from "../types.ts"

/**
 * Batch-insert readings in a single transaction.
 */
export function insertReadings(db: Database, readings: Reading[]): number {
  const stmt = db.prepare(
    `INSERT INTO readings (station_id, timestamp, temp_c, humidity, wind_speed_kmh, precip_mm, pressure_hpa)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )

  const tx = db.transaction(() => {
    for (const r of readings) {
      stmt.run(r.stationId, r.timestamp, r.tempC, r.humidity, r.windSpeedKmh, r.precipMm, r.pressureHpa)
    }
  })
  tx()
  return readings.length
}

/**
 * Get readings for a station since a given date.
 */
export function getReadings(db: Database, stationId: string, since: Date): Reading[] {
  const rows = db.query<
    { station_id: string; timestamp: string; temp_c: number; humidity: number; wind_speed_kmh: number; precip_mm: number; pressure_hpa: number },
    [string, string]
  >(
    `SELECT station_id, timestamp, temp_c, humidity, wind_speed_kmh, precip_mm, pressure_hpa
     FROM readings WHERE station_id = ? AND timestamp >= ? ORDER BY timestamp`,
  ).all(stationId, since.toISOString())

  return rows.map((r) => ({
    stationId: r.station_id,
    timestamp: r.timestamp,
    tempC: r.temp_c,
    humidity: r.humidity,
    windSpeedKmh: r.wind_speed_kmh,
    precipMm: r.precip_mm,
    pressureHpa: r.pressure_hpa,
  }))
}

/**
 * Delete readings older than a cutoff date. Returns count deleted.
 */
export function deleteOlderThan(db: Database, cutoff: Date): number {
  const result = db.run("DELETE FROM readings WHERE timestamp < ?", [cutoff.toISOString()])
  return result.changes
}
