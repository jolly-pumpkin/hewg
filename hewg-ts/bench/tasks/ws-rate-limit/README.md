# Task: Add Rate-Limit Detection

## Context

This is a weather station data aggregator. It fetches forecasts from the Open-Meteo API, stores them in SQLite, and generates reports. The source is in `src/`.

## Task

Add rate-limit detection and propagate it as a typed error:

1. Add a `RateLimitError` class to `src/types.ts` that extends `WeatherError`:
   - Constructor takes `retryAfterMs: number` and `message: string`
   - The `code` field should be `"RATE_LIMITED"`
2. In `src/api/client.ts`, detect HTTP 429 responses:
   - Parse the `Retry-After` header (value is in seconds) to get `retryAfterMs`
   - Throw `RateLimitError` instead of the generic `ApiError` for 429 responses
3. In `src/services/sync.ts`, catch `RateLimitError` in `syncStation`:
   - Add it to `SyncResult.errors` instead of rethrowing
4. In `src/commands/fetch.ts`, after syncing all stations:
   - Check results for rate-limit errors and print a warning with the retry-after value
5. Do **not** modify any pure functions: `transform.ts`, `analytics.ts`, `alerts.ts`, `table.ts`.

## Verification

Run `bash test.sh` — exit code 0 means success.
