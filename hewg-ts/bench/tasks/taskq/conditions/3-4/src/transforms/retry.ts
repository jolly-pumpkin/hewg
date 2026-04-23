/**
 * @hewg-module taskq/transforms/retry
 *
 * Retry policy helpers: backoff calculation, retry eligibility, and
 * next-attempt scheduling.
 */

import type { Job } from "../types/job";
import { JobStatus } from "../types/job";

const JITTER_FACTOR = 0.2;
const MAX_BACKOFF_MS = 300_000; // 5 minutes

/**
 * Calculate exponential backoff with bounded jitter.
 *
 * The formula is:
 *   delay = min(baseDelay * 2^attempt, MAX_BACKOFF) * (1 +/- jitter)
 *
 * Jitter is deterministic based on the attempt number so that the
 * same call always returns the same result (pure function).
 * @hewg-module taskq/transforms/retry
 * @effects
 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number,
): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const capped = Math.min(exponential, MAX_BACKOFF_MS);

  // Deterministic jitter derived from attempt number so the function
  // remains pure.  We use a simple sine-based mapping that gives a
  // value in [-1, 1], then scale by JITTER_FACTOR.
  const jitterSeed = Math.sin(attempt * 7919) * 0.5 + 0.5; // 0..1
  const jitter = 1 + JITTER_FACTOR * (jitterSeed * 2 - 1);

  return Math.round(capped * jitter);
}

/**
 * Determine whether a job is eligible for another retry.
 * A job can be retried when it has failed (not dead-lettered)
 * and has remaining attempts.
 * @hewg-module taskq/transforms/retry
 * @effects
 */
export function shouldRetry(job: Job): boolean {
  if (job.status !== JobStatus.Failed) {
    return false;
  }
  return job.attempts < job.maxAttempts;
}

/**
 * Compute the Date at which the next retry attempt should fire,
 * based on the current attempt count and a base delay.
 *
 * Returns a Date in the future offset by the calculated backoff.
 * The `now` parameter defaults to the current time but can be
 * injected for deterministic testing.
 * @hewg-module taskq/transforms/retry
 * @effects
 */
export function nextRetryAt(
  job: Job,
  baseDelay: number,
  now: Date = new Date(),
): Date {
  const backoffMs = calculateBackoff(job.attempts, baseDelay);
  return new Date(now.getTime() + backoffMs);
}

/**
 * Return the number of remaining retry attempts for a job.
 * @hewg-module taskq/transforms/retry
 * @effects
 */
export function remainingAttempts(job: Job): number {
  return Math.max(0, job.maxAttempts - job.attempts);
}
