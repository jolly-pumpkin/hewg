
import type { Job } from "../types/job";

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

export function createRetryPolicy(
  overrides?: Partial<RetryPolicy>,
): RetryPolicy {
  return {
    ...DEFAULT_RETRY_POLICY,
    ...overrides,
  };
}

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
