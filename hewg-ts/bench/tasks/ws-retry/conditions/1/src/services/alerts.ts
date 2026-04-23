
import type { Reading, Alert, AlertThresholds } from "../types.ts"

export function checkAlerts(readings: Reading[], thresholds: AlertThresholds): Alert[] {
  const alerts: Alert[] = []

  for (const r of readings) {
    if (r.tempC > thresholds.highTemp) {
      alerts.push({ stationId: r.stationId, timestamp: r.timestamp, kind: "high-temp", value: r.tempC, threshold: thresholds.highTemp })
    }
    if (r.tempC < thresholds.lowTemp) {
      alerts.push({ stationId: r.stationId, timestamp: r.timestamp, kind: "low-temp", value: r.tempC, threshold: thresholds.lowTemp })
    }
    if (r.windSpeedKmh > thresholds.highWind) {
      alerts.push({ stationId: r.stationId, timestamp: r.timestamp, kind: "high-wind", value: r.windSpeedKmh, threshold: thresholds.highWind })
    }
    if (r.precipMm > thresholds.highPrecip) {
      alerts.push({ stationId: r.stationId, timestamp: r.timestamp, kind: "high-precip", value: r.precipMm, threshold: thresholds.highPrecip })
    }
  }

  return alerts
}

export function formatAlert(alert: Alert): string {
  return `[${alert.kind.toUpperCase()}] station=${alert.stationId} time=${alert.timestamp} value=${alert.value} threshold=${alert.threshold}`
}
