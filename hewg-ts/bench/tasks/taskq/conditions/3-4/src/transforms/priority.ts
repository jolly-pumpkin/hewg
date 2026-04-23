/**
 * @hewg-module taskq/transforms/priority
 *
 * Priority comparison and effective-priority calculations for
 * the job scheduling subsystem.
 */

import type { Job } from "../types/job";
import { JobPriority } from "../types/job";

/**
 * Compare two jobs by priority for use with Array.prototype.sort.
 * Higher-priority jobs sort first (descending). Ties are broken by
 * creation time so that older jobs of the same priority run first.
 * @hewg-module taskq/transforms/priority
 * @effects
 */
export function comparePriority(a: Job, b: Job): number {
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/**
 * Calculate an effective priority score that includes an age-based
 * boost so that long-waiting lower-priority jobs are eventually
 * promoted.  The boost is:
 *
 *   effectivePriority = basePriority + ageFactor * ageMinutes
 *
 * where ageMinutes is computed from the job's createdAt to now.
 * The result is clamped to the Critical ceiling so that boosted
 * jobs never exceed the highest tier.
 * @hewg-module taskq/transforms/priority
 * @effects
 */
export function calculateEffectivePriority(
  job: Job,
  ageFactor: number,
  now: Date = new Date(),
): number {
  const ageMs = now.getTime() - job.createdAt.getTime();
  const ageMinutes = Math.max(0, ageMs / 60_000);

  const boosted = job.priority + ageFactor * ageMinutes;
  return Math.min(boosted, JobPriority.Critical);
}

/**
 * Determine whether a candidate job should preempt a currently
 * running job.  Preemption only happens when the candidate is at
 * least two priority tiers higher (e.g. Critical vs Normal) and
 * the running job has been active for at least 5 000 ms, to avoid
 * excessive context switching.
 * @hewg-module taskq/transforms/priority
 * @effects
 */
export function shouldPreempt(
  running: Job,
  candidate: Job,
  now: Date = new Date(),
): boolean {
  const PREEMPTION_THRESHOLD = 2;
  const MIN_RUNTIME_MS = 5_000;

  const priorityGap = candidate.priority - running.priority;
  if (priorityGap < PREEMPTION_THRESHOLD) {
    return false;
  }

  const runtimeMs = now.getTime() - running.updatedAt.getTime();
  return runtimeMs >= MIN_RUNTIME_MS;
}
