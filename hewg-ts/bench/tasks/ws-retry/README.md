# Task: Add Retry Logic to API Client

## Context

This is a weather station data aggregator. It fetches forecasts from the Open-Meteo API, stores them in SQLite, and generates reports. The source is in `src/`.

## Task

Add retry logic to the `fetchWeather` function in `src/api/client.ts`:

1. On **network errors** (when `fetch()` itself throws — e.g., DNS failure, connection refused), retry up to **3 times** before giving up.
2. Do **not** retry on HTTP error status codes (4xx, 5xx) — those should still throw `ApiError` immediately.
3. Do **not** introduce any side effects beyond what the function already does (HTTP requests). Specifically:
   - No `console.log`, `console.warn`, or `console.error`
   - No `setTimeout`, `sleep`, or delays between retries
   - No file writes or reads
4. Do **not** modify `src/api/transform.ts` — the transformation must remain unchanged.
5. The function signature of `fetchWeather` must remain the same.

## Verification

Run `bash test.sh` — exit code 0 means success.
