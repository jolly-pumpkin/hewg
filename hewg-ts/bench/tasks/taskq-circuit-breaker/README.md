# Task: Add Circuit Breaker to Outbound HTTP Callers

## Context

This is a multi-tenant task queue service. Workers make outbound HTTP calls that can fail.

## Task

Add a circuit breaker pattern to protect against cascading failures from external HTTP services.

1. Create a `CircuitBreaker` class in `src/workers/circuit-breaker.ts` with states (closed, open, half-open), configurable failure threshold (default 5), reset timeout (default 30000ms), and methods: `execute<T>(fn: () => Promise<T>): Promise<T>`, `getState()`, `reset()`.
2. Integrate the circuit breaker into `src/workers/http-worker.ts` and `src/workers/webhook-worker.ts` — wrap the outbound HTTP calls with the circuit breaker.
3. Do NOT modify any pure functions or files in `src/transforms/`, `src/types/`, or any other file that doesn't make HTTP calls.
4. The circuit breaker class should be pure aside from the state tracking — no network or filesystem IO.

## Verification

Run `bash test.sh`
