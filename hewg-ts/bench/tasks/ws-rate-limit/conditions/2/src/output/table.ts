
import type { DailySummary } from "../types.ts"

/**
 * Render daily summaries as a padded text table.
 */
export function renderTable(summaries: DailySummary[]): string {
  const header = "Date        | Min C | Max C | Avg C | Precip mm | Humidity % | Wind km/h"
  const sep = "-".repeat(header.length)
  const rows = summaries.map((s) =>
    [
      s.date.padEnd(11),
      s.minTemp.toFixed(1).padStart(5),
      s.maxTemp.toFixed(1).padStart(5),
      s.avgTemp.toFixed(1).padStart(5),
      s.totalPrecip.toFixed(1).padStart(9),
      s.avgHumidity.toFixed(0).padStart(10),
      s.avgWind.toFixed(1).padStart(9),
    ].join(" | "),
  )
  return [header, sep, ...rows].join("\n")
}
