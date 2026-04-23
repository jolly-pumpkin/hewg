
import type { Reading, DailySummary } from "../types.ts"

/**
 * Group readings by date and compute daily summaries.
 */
export function computeDailySummaries(readings: Reading[]): DailySummary[] {
  const byDate = new Map<string, Reading[]>()

  for (const r of readings) {
    const date = r.timestamp.slice(0, 10)
    const group = byDate.get(date) ?? []
    group.push(r)
    byDate.set(date, group)
  }

  const summaries: DailySummary[] = []
  for (const [date, group] of byDate) {
    const temps = group.map((r) => r.tempC)
    summaries.push({
      stationId: group[0].stationId,
      date,
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
      avgTemp: temps.reduce((a, b) => a + b, 0) / temps.length,
      totalPrecip: group.reduce((a, r) => a + r.precipMm, 0),
      avgHumidity: group.reduce((a, r) => a + r.humidity, 0) / group.length,
      avgWind: group.reduce((a, r) => a + r.windSpeedKmh, 0) / group.length,
    })
  }

  return summaries.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Compute aggregate statistics across daily summaries.
 */
export function computeStationStats(summaries: DailySummary[]): {
  minTemp: number
  maxTemp: number
  avgTemp: number
  totalPrecip: number
  avgWind: number
} {
  if (summaries.length === 0) {
    return { minTemp: 0, maxTemp: 0, avgTemp: 0, totalPrecip: 0, avgWind: 0 }
  }
  return {
    minTemp: Math.min(...summaries.map((s) => s.minTemp)),
    maxTemp: Math.max(...summaries.map((s) => s.maxTemp)),
    avgTemp: summaries.reduce((a, s) => a + s.avgTemp, 0) / summaries.length,
    totalPrecip: summaries.reduce((a, s) => a + s.totalPrecip, 0),
    avgWind: summaries.reduce((a, s) => a + s.avgWind, 0) / summaries.length,
  }
}
