# Weather Station — Annotation Guide

This project uses Hewg annotations in JSDoc comments to declare function contracts.

## Key annotations

- `@hewg-module <path>` — Declares which module a file belongs to. Use it to understand the dependency graph.
- `@effects <list>` — Declares what side effects a function performs. An empty `@effects` means the function is **pure** (no IO, no side effects). Common effects:
  - `net.https` — makes HTTP requests
  - `fs.read` — reads from the filesystem
  - `fs.write` — writes to the filesystem
  - `log` — writes to console/stdout
- `@cap <name> <effect>` — Declares a capability the function requires (e.g., `@cap out fs.write` means it needs write access).
- `@pre <condition>` — Precondition that must hold when calling the function.
- `@post <condition>` — Postcondition guaranteed after the function returns.

## How to use annotations when editing

- **Before modifying a file**, check its `@effects`. If a function is pure (`@effects` with no list), do not add IO operations to it.
- **When adding new functionality**, propagate changes only through files whose `@effects` include the relevant effect. Pure files should not be touched.
- **When creating new files**, follow the annotation pattern of similar existing files.

## Architecture (by effect boundary)

**Pure (no effects):**
- `src/api/transform.ts` — converts API responses to domain types
- `src/services/analytics.ts` — computes daily summaries and stats
- `src/services/alerts.ts` — checks thresholds, produces alerts
- `src/output/table.ts` — renders text tables

**Network IO (`net.https`):**
- `src/api/client.ts` — fetches from Open-Meteo API
- `src/services/sync.ts` — orchestrates fetch → transform → store

**Filesystem IO (`fs.read`, `fs.write`):**
- `src/db/connection.ts` — opens SQLite database
- `src/output/csv.ts` — writes CSV files
- `src/output/json.ts` — writes JSON files
- `src/config.ts` — reads config file

**Mixed (multiple effects):**
- `src/commands/fetch.ts` — net.https, fs.read, fs.write, log
- `src/commands/report.ts` — fs.read, fs.write, log
- `src/commands/prune.ts` — fs.read, fs.write, log
- `src/cli.ts` — all effects (entry point)

<!-- hewg:start -->
# Hewg Annotation Guide

This project uses Hewg annotations in JSDoc comments to declare function contracts.

## Annotations

- `@effects <list>` — Declares what side effects a function performs. An empty `@effects` (no list) means the function is **pure** — no IO, no side effects. Common effects:
  - `net.https` / `net.http` — makes HTTP requests
  - `fs.read` — reads from the filesystem
  - `fs.write` — writes to the filesystem
  - `log` — writes to console/stdout
  - `proc.exec` / `proc.spawn` — runs child processes
  - `rand` — uses random number generation
  - `time.read` / `time.sleep` — reads clock or sleeps
- `@hewg-module <path>` — Declares which module a file belongs to.
- `@cap <name> <effect>` — Declares a capability parameter the function requires.
- `@pre <condition>` — Precondition that must hold when calling the function.
- `@post <condition>` — Postcondition guaranteed after the function returns.
- `@idempotent` — Function is safe to call multiple times with the same arguments.
- `@layer <tier>` — Architectural tier: `api`, `service`, `command`, `output`, or `lib`.

## Rules for modifying annotated code

| You want to... | Check | Action |
|-----------------|-------|--------|
| Add IO (fetch, console.log, fs) to a function | Does `@effects` have no listed effects? | **STOP.** The function is pure. Add the IO in a caller that already declares the relevant effect. |
| Add IO to a function | Does `@effects` already list the needed effect? | Proceed — the function already performs this kind of IO. |
| Add IO to a function | `@effects` lists other effects but not this one | Update `@effects` to include the new effect, or move the IO to a different function. |
| Call a new function from an existing one | Does the callee have effects the caller lacks? | **STOP.** You would introduce an undeclared effect. Move the call to an appropriate site. |
| Create a new function | — | Add `@effects` listing every IO it performs. If none, use empty `@effects`. |
| Modify a function with `@pre`/`@post` | — | Ensure your changes preserve the preconditions and postconditions. |

## Architecture (by effect boundary)

**Pure (no effects):**
- `src/api/transform.ts`
- `src/db/migrations.ts`
- `src/db/readings.ts`
- `src/db/stations.ts`
- `src/output/table.ts`
- `src/services/alerts.ts`
- `src/services/analytics.ts`

**net.https:**
- `src/api/client.ts`
- `src/services/sync.ts`

**fs.read, fs.write, log, net.https:**
- `src/cli.ts`
- `src/commands/fetch.ts`

**fs.read, fs.write, log:**
- `src/commands/prune.ts`
- `src/commands/report.ts`

**fs.read:**
- `src/config.ts`

**fs.read, fs.write:**
- `src/db/connection.ts`

**fs.write:**
- `src/output/csv.ts`
- `src/output/json.ts`

## Effect call graph

Functions with effects and their callees:

**main** (`src/cli.ts`) `@effects net.https, fs.read, fs.write, log`
  → args.includes [pure]
  → args.indexOf [pure]
  → loadConfig [fs.read]
  → parseIntArg [pure]
  → runFetch [net.https, fs.read, fs.write, log]
  → parseArg [pure]
  → runReport [fs.read, fs.write, log]
  → runPrune [fs.read, fs.write, log]
  → console.error [log]
  → process.exit [proc.exit]

**loadConfig** (`src/config.ts`) `@effects fs.read`
  → Bun.file(path).json [pure]
  → Bun.file [pure]
  → defaultConfig [pure]

**fetchWeather** (`src/api/client.ts`) `@effects net.https`
  → String [pure]
  → fetch [net.https]
  → res.text [pure]
  → res.json [pure]

**runFetch** (`src/commands/fetch.ts`) `@effects net.https, fs.read, fs.write, log`
  → openDb [fs.read, fs.write]
  → console.log [log]
  → syncAllStations [net.https]
  → console.error [log]
  → r.errors.map((e) => e.message).join [pure]
  → r.errors.map [pure]
  → since.setDate [pure]
  → since.getDate [pure]
  → getReadings [pure]
  → checkAlerts [pure]
  → formatAlert [pure]
  → db.close [pure]

**runPrune** (`src/commands/prune.ts`) `@effects fs.read, fs.write, log`
  → openDb [fs.read, fs.write]
  → cutoff.setDate [pure]
  → cutoff.getDate [pure]
  → deleteOlderThan [pure]
  → console.log [log]
  → db.close [pure]

**runReport** (`src/commands/report.ts`) `@effects fs.read, fs.write, log`
  → openDb [fs.read, fs.write]
  → since.setDate [pure]
  → since.getDate [pure]
  → listStations [pure]
  → getReadings [pure]
  → console.log [log]
  → computeDailySummaries [pure]
  → computeStationStats [pure]
  → stats.minTemp.toFixed [pure]
  → stats.maxTemp.toFixed [pure]
  → stats.avgTemp.toFixed [pure]
  → stats.totalPrecip.toFixed [pure]
  → stats.avgWind.toFixed [pure]
  → renderTable [pure]
  → writeCsv [fs.write]
  → writeJson [fs.write]
  → db.close [pure]

**openDb** (`src/db/connection.ts`) `@effects fs.read, fs.write`
  → db.exec [pure]
  → runMigrations [pure]

**writeCsv** (`src/output/csv.ts`) `@effects fs.write`
  → summaries.map [pure]
  → [s.date, s.stationId, s.minTemp, s.maxTemp, s.avgTemp, s.totalPrecip, s.avgHumidity, s.avgWind].join [pure]
  → [header, ...rows].join [pure]
  → Bun.write [pure]

**writeJson** (`src/output/json.ts`) `@effects fs.write`
  → Bun.write [pure]
  → JSON.stringify [pure]

**syncStation** (`src/services/sync.ts`) `@effects net.https`
  → upsertStation [pure]
  → fetchWeather [net.https]
  → transformResponse [pure]
  → insertReadings [pure]
  → errors.push [pure]
  → String [pure]

**syncAllStations** (`src/services/sync.ts`) `@effects net.https`
  → results.push [pure]
  → syncStation [net.https]


## Quick reference

- `@effects` (empty) = **pure function** — no IO allowed
- `@effects net.https, fs.write` = function performs these IO operations (and only these)
- `@idempotent` = safe to retry or cache
<!-- hewg:end -->
