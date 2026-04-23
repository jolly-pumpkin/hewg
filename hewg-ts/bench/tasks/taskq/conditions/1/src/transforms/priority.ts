
import type { Job } from "../types/job";
import { JobPriority } from "../types/job";

export function comparePriority(a: Job, b: Job): number {
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }
  return a.createdAt.getTime() - b.createdAt.getTime();
}

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
