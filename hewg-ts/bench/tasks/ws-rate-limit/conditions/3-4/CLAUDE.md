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
