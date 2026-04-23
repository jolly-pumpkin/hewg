
import type { AppConfig } from "./types.ts"

export async function loadConfig(path: string): Promise<AppConfig> {
  const raw = await Bun.file(path).json()
  return { ...defaultConfig(), ...raw } as AppConfig
}

export function defaultConfig(): AppConfig {
  return {
    dbPath: "weather.db",
    stations: [],
    alertThresholds: { highTemp: 35, lowTemp: -10, highWind: 80, highPrecip: 50 },
    defaultFormat: "table",
  }
}
