
import type { Job } from "../types/job";
import { JobStatus } from "../types/job";

const JITTER_FACTOR = 0.2;
const MAX_BACKOFF_MS = 300_000; // 5 minutes

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

export function shouldRetry(job: Job): boolean {
  if (job.status !== JobStatus.Failed) {
    return false;
  }
  return job.attempts < job.maxAttempts;
}

export function nextRetryAt(
  job: Job,
  baseDelay: number,
  now: Date = new Date(),
): Date {
  const backoffMs = calculateBackoff(job.attempts, baseDelay);
  return new Date(now.getTime() + backoffMs);
}

export function remainingAttempts(job: Job): number {
  return Math.max(0, job.maxAttempts - job.attempts);
}
