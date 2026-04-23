/**
 *
 * JSON serialization and deserialization for queue data structures.
 */

import type { Job } from "../types/job";
import type { UsageRecord } from "../types/billing";

/**
 * Serialize a Job to a JSON string, converting Date fields to
 * ISO-8601 strings for safe transport and storage.
 */
export function serializeJob(job: Job): string {
  return JSON.stringify({
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    scheduledAt: job.scheduledAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  });
}

/**
 * Deserialize a JSON string back into a Job, restoring Date fields
 * from their ISO-8601 representations.
 */
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

/**
 * Serialize an array of Jobs to a JSON string.
 * Each job's Date fields are converted to ISO-8601 strings.
 */
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

/**
 * Serialize a UsageRecord to a JSON string.
 */
export function serializeUsageRecord(usage: UsageRecord): string {
  return JSON.stringify(usage);
}

/**
 * Deserialize a JSON string back into a UsageRecord.
 */
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
