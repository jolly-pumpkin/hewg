/**
 * @hewg-module weather/api/types
 */

export type OpenMeteoHourly = {
  time: string[]
  temperature_2m: number[]
  relative_humidity_2m: number[]
  wind_speed_10m: number[]
  precipitation: number[]
  surface_pressure: number[]
}

export type OpenMeteoResponse = {
  latitude: number
  longitude: number
  elevation: number
  hourly: OpenMeteoHourly
}
