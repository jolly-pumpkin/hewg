/**
 * @hewg-module weather/cli
 */

import { loadConfig } from "./config.ts"
import { runFetch } from "./commands/fetch.ts"
import { runReport } from "./commands/report.ts"
import { runPrune } from "./commands/prune.ts"
import type { ReportFormat } from "./types.ts"

/**
 * CLI entry point. Parses arguments and dispatches to the appropriate command.
 * @effects net.https, fs.read, fs.write, log
 */
export async function main(args: string[]): Promise<void> {
  const command = args[0]
  const configPath = args.includes("--config")
    ? args[args.indexOf("--config") + 1]
    : "weather.config.json"

  const config = await loadConfig(configPath)

  switch (command) {
    case "fetch": {
      const days = parseIntArg(args, "--days", 3)
      await runFetch(config, days)
      break
    }
    case "report": {
      const format = (parseArg(args, "--format") ?? config.defaultFormat) as ReportFormat
      const days = parseIntArg(args, "--days", 7)
      const stationId = parseArg(args, "--station") ?? undefined
      const outPath = parseArg(args, "--out") ?? undefined
      await runReport(config, { format, days, stationId, outPath })
      break
    }
    case "prune": {
      const days = parseIntArg(args, "--days", 30)
      await runPrune(config, days)
      break
    }
    default:
      console.error(`Unknown command: ${command ?? "(none)"}`)
      console.error("Usage: weather <fetch|report|prune> [options]")
      process.exit(1)
  }
}

function parseArg(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null
}

function parseIntArg(args: string[], flag: string, fallback: number): number {
  const val = parseArg(args, flag)
  return val !== null ? parseInt(val, 10) : fallback
}
