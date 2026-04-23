/**
 * @hewg-module weather/api/client
 */

import { ApiError } from "../types.ts"
import type { OpenMeteoResponse } from "./types.ts"

const BASE_URL = "https://api.open-meteo.com/v1/forecast"

/**
 * Fetch hourly weather data from Open-Meteo for the given coordinates.
 * @effects net.https
 */
export async function fetchWeather(
  lat: number,
  lon: number,
  days: number,
): Promise<OpenMeteoResponse> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,surface_pressure",
    forecast_days: String(days),
  })

  const res = await fetch(`${BASE_URL}?${params}`)
  if (!res.ok) {
    throw new ApiError(res.status, await res.text())
  }
  return (await res.json()) as OpenMeteoResponse
}
