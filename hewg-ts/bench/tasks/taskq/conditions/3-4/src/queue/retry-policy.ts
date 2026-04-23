/**
 * @hewg-module taskq/queue/retry-policy
 *
 * Retry policy configuration and application for failed jobs.
 */

import type { Job } from "../types/job";

/** Configuration for how job retries are handled. */
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
}

/** Default retry policy used when no overrides are provided. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

/**
 * Create a retry policy by merging optional overrides with the defaults.
 * @hewg-module taskq/queue/retry-policy
 * @effects
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
 * @hewg-module taskq/queue/retry-policy
 * @effects
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
