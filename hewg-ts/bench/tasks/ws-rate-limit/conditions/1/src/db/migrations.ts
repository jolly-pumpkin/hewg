
import type { Database } from "bun:sqlite"

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      elevation REAL NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id TEXT NOT NULL REFERENCES stations(id),
      timestamp TEXT NOT NULL,
      temp_c REAL NOT NULL,
      humidity REAL NOT NULL,
      wind_speed_kmh REAL NOT NULL,
      precip_mm REAL NOT NULL,
      pressure_hpa REAL NOT NULL
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_readings_station_time
    ON readings(station_id, timestamp)
  `)
}
