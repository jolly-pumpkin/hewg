# Task: Add In-Memory Cache to API Layer

## Context

This is a weather station data aggregator. It fetches forecasts from the Open-Meteo API, stores them in SQLite, and generates reports. The source is in `src/`.

## Task

Add an in-memory cache to avoid redundant API calls when syncing multiple times:

1. Create a new file `src/api/cache.ts` that exports:
   - `getCachedWeather(lat: number, lon: number, days: number, maxAgeMs: number): OpenMeteoResponse | null`
   - `setCachedWeather(lat: number, lon: number, days: number, response: OpenMeteoResponse): void`
   - `clearCache(): void`
2. The cache must be **pure** — use an in-memory `Map`, no filesystem or network access.
3. Modify `src/services/sync.ts` to check the cache before calling `fetchWeather`. On a cache miss, fetch from the API and store the result in the cache.
4. Do **not** modify `src/api/client.ts` or `src/api/transform.ts`.
5. The `syncStation` function signature must remain the same.

## Verification

Run `bash test.sh` — exit code 0 means success.
