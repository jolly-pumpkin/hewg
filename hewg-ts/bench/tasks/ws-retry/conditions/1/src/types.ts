
export type Station = {
  id: string
  name: string
  lat: number
  lon: number
  elevation: number
}

export type Reading = {
  stationId: string
  timestamp: string
  tempC: number
  humidity: number
  windSpeedKmh: number
  precipMm: number
  pressureHpa: number
}

export type DailySummary = {
  stationId: string
  date: string
  minTemp: number
  maxTemp: number
  avgTemp: number
  totalPrecip: number
  avgHumidity: number
  avgWind: number
}

export type AlertThresholds = {
  highTemp: number
  lowTemp: number
  highWind: number
  highPrecip: number
}

export type Alert = {
  stationId: string
  timestamp: string
  kind: "high-temp" | "low-temp" | "high-wind" | "high-precip"
  value: number
  threshold: number
}

export type ReportFormat = "table" | "csv" | "json"

export type SyncResult = {
  station: Station
  readingsCount: number
  errors: Error[]
}

export type AppConfig = {
  dbPath: string
  stations: Station[]
  alertThresholds: AlertThresholds
  defaultFormat: ReportFormat
}

export class WeatherError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "WeatherError"
  }
}

export class ApiError extends WeatherError {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super("API_ERROR", `HTTP ${status}: ${message}`)
    this.name = "ApiError"
  }
}

export class DbError extends WeatherError {
  constructor(message: string) {
    super("DB_ERROR", message)
    this.name = "DbError"
  }
}
