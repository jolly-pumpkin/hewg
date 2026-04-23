# Task: Add HTML Export Format

## Context

This is a weather station data aggregator. It fetches forecasts from the Open-Meteo API, stores them in SQLite, and generates reports in different formats. The source is in `src/`.

The existing output modules follow a pattern:
- `src/output/table.ts` — renders to a string (pure, no file IO)
- `src/output/csv.ts` — writes to a file
- `src/output/json.ts` — writes to a file

## Task

Add an HTML export format:

1. Create `src/output/html.ts` that exports `writeHtml(path: string, summaries: DailySummary[]): void`.
2. The function should write an HTML file containing a `<table>` with headers matching the DailySummary fields (date, min temp, max temp, avg temp, total precip, avg humidity, avg wind).
3. Follow the pattern of `csv.ts` and `json.ts` — write to the filesystem using `Bun.write()`.
4. Add `"html"` to the `ReportFormat` type union in `src/types.ts`.
5. Update `src/commands/report.ts` to handle the `"html"` format by calling `writeHtml`.

## Verification

Run `bash test.sh` — exit code 0 means success.
