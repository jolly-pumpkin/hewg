
import type { Reading } from "../types.ts"
import type { OpenMeteoResponse } from "./types.ts"

/**
 * Transform an Open-Meteo API response into domain Reading objects.
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
