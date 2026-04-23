/**
 * @hewg-module weather/services/sync
 */

import type { Database } from "bun:sqlite"
import type { Station, SyncResult } from "../types.ts"
import { fetchWeather } from "../api/client.ts"
import { transformResponse } from "../api/transform.ts"
import { upsertStation } from "../db/stations.ts"
import { insertReadings } from "../db/readings.ts"

/**
 * Sync weather data for a single station: fetch from API, transform, and store.
 * @effects net.https
 */
export async function syncStation(
  db: Database,
  station: Station,
  days: number,
): Promise<SyncResult> {
  const errors: Error[] = []
  let readingsCount = 0

  try {
    upsertStation(db, station)
    const raw = await fetchWeather(station.lat, station.lon, days)
    const readings = transformResponse(station.id, raw)
    readingsCount = insertReadings(db, readings)
  } catch (err) {
    errors.push(err instanceof Error ? err : new Error(String(err)))
  }

  return { station, readingsCount, errors }
}

/**
 * Sync all configured stations sequentially.
 * @effects net.https
 */
export async function syncAllStations(
  db: Database,
  stations: Station[],
  days: number,
): Promise<SyncResult[]> {
  const results: SyncResult[] = []
  for (const station of stations) {
    results.push(await syncStation(db, station, days))
  }
  return results
}
