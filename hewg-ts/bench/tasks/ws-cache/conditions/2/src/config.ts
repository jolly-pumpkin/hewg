
import type { AppConfig } from "./types.ts"

/**
 * Load application config from a JSON file.
 */
export async function loadConfig(path: string): Promise<AppConfig> {
  const raw = await Bun.file(path).json()
  return { ...defaultConfig(), ...raw } as AppConfig
}

/**
 * Return sensible defaults.
 */
export function defaultConfig(): AppConfig {
  return {
    dbPath: "weather.db",
    stations: [],
    alertThresholds: { highTemp: 35, lowTemp: -10, highWind: 80, highPrecip: 50 },
    defaultFormat: "table",
  }
}
