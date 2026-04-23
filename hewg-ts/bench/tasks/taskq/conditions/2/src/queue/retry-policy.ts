/**
 *
 * Retry policy configuration and application for failed jobs.
 */

import type { Job } from "../types/job";

/**
 * Create a retry policy by merging optional overrides with the defaults.
 */
export function createRetryPolicy(
  overrides?: Partial<RetryPolicy>,
): RetryPolicy {
  return {
    ...DEFAULT_RETRY_POLICY,
    ...overrides,
  };
}

/**
 * Evaluate whether a job should be retried based on the given policy.
 * Returns the retry decision, next attempt timestamp, and computed delay.
 */
export function applyRetryPolicy(
  job: Job,
  policy: RetryPolicy,
): { shouldRetry: boolean; nextAttemptAt: Date | null; delay: number } {
  if (job.attempts >= policy.maxAttempts) {
    return { shouldRetry: false, nextAttemptAt: null, delay: 0 };
  }

  const delay = Math.min(
    policy.baseDelay * Math.pow(policy.backoffMultiplier, job.attempts - 1),
    policy.maxDelay,
  );

  const nextAttemptAt = new Date(job.updatedAt.getTime() + delay);

  return { shouldRetry: true, nextAttemptAt, delay };
}
