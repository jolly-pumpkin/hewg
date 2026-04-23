
import type { Job } from "../types/job";
import type { UsageRecord } from "../types/billing";

export function serializeJob(job: Job): string {
  return JSON.stringify({
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    scheduledAt: job.scheduledAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  });
}

export function deserializeJob(raw: string): Job {
  const parsed = JSON.parse(raw);

  return {
    ...parsed,
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt),
    scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : undefined,
    completedAt: parsed.completedAt ? new Date(parsed.completedAt) : undefined,
  } as Job;
}

export function serializeJobList(jobs: Job[]): string {
  const serializable = jobs.map((job) => ({
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    scheduledAt: job.scheduledAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  }));
  return JSON.stringify(serializable);
}

export function serializeUsageRecord(usage: UsageRecord): string {
  return JSON.stringify(usage);
}

export function deserializeUsageRecord(raw: string): UsageRecord {
  const parsed = JSON.parse(raw);
  return {
    tenantId: parsed.tenantId,
    period: parsed.period,
    jobsSubmitted: parsed.jobsSubmitted,
    jobsCompleted: parsed.jobsCompleted,
    jobsFailed: parsed.jobsFailed,
    totalDurationMs: parsed.totalDurationMs,
  } as UsageRecord;
}
