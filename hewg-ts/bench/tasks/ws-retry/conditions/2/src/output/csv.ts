
import type { DailySummary } from "../types.ts"

/**
 * Write daily summaries to a CSV file.
 */
export function writeCsv(path: string, summaries: DailySummary[]): void {
  const header = "date,station_id,min_temp,max_temp,avg_temp,total_precip,avg_humidity,avg_wind"
  const rows = summaries.map((s) =>
    [s.date, s.stationId, s.minTemp, s.maxTemp, s.avgTemp, s.totalPrecip, s.avgHumidity, s.avgWind].join(","),
  )
  const content = [header, ...rows].join("\n") + "\n"
  Bun.write(path, content)
}
