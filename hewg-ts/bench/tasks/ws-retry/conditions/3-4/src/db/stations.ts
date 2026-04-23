/**
 * @hewg-module weather/db/stations
 */

import type { Database } from "bun:sqlite"
import type { Station } from "../types.ts"

/**
 * Insert or replace a station record.
 * @effects
 */
export function upsertStation(db: Database, station: Station): void {
  db.run(
    `INSERT OR REPLACE INTO stations (id, name, lat, lon, elevation)
     VALUES (?, ?, ?, ?, ?)`,
    [station.id, station.name, station.lat, station.lon, station.elevation],
  )
}

/**
 * Look up a station by ID.
 * @effects
 */
export function getStation(db: Database, id: string): Station | null {
  return db.query<Station, [string]>(
    "SELECT id, name, lat, lon, elevation FROM stations WHERE id = ?",
  ).get(id)
}

/**
 * List all known stations.
 * @effects
 */
export function listStations(db: Database): Station[] {
  return db.query<Station, []>("SELECT id, name, lat, lon, elevation FROM stations").all()
}
