/**
 * @hewg-module weather/api/transform
 */

import type { Reading } from "../types.ts"
import type { OpenMeteoResponse } from "./types.ts"

/**
 * Transform an Open-Meteo API response into domain Reading objects.
 * @effects
 * @pre raw.hourly.time.length > 0
 * @post result.every(r => r.stationId === stationId)
 */
export function transformResponse(
  stationId: string,
  raw: OpenMeteoResponse,
): Reading[] {
  const { hourly } = raw
  const readings: Reading[] = []

  for (let i = 0; i < hourly.time.length; i++) {
    readings.push({
      stationId,
      timestamp: hourly.time[i],
      tempC: hourly.temperature_2m[i],
      humidity: hourly.relative_humidity_2m[i],
      windSpeedKmh: hourly.wind_speed_10m[i],
      precipMm: hourly.precipitation[i],
      pressureHpa: hourly.surface_pressure[i],
    })
  }

  return readings
}
