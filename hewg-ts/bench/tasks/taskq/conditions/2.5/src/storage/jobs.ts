/**
 *
 * CRUD operations for jobs in the simulated JSON-file database.
 */

import type { Job, JobId, JobStatus } from "../types/job";
import type { TenantId } from "../types/tenant";
import type { Database } from "./connection";
import { readDataFile, writeDataFile } from "./connection";

/**
 * Insert a new job into the database.
 *
 */
export function insertJob(db: Database, job: Job): void {
  const data = readDataFile(db);
  data.jobs[job.id] = job;
  writeDataFile(db, data);
}

/**
 * Retrieve a job by its identifier, or null if not found.
 *
 */
export function getJob(db: Database, id: JobId): Job | null {
  const data = readDataFile(db);
  const record = data.jobs[id];
  return (record as Job) ?? null;
}

/**
 * Update a job's status and optionally attach a result payload.
 *
 */
export function updateJobStatus(
  db: Database,
  id: JobId,
  status: JobStatus,
  result?: unknown,
): void {
  const data = readDataFile(db);
  const job = data.jobs[id] as Job | undefined;
  if (!job) return;

  job.status = status;
  job.updatedAt = new Date();
  if (result !== undefined) job.result = result;

  writeDataFile(db, data);
}

/**
 * List all jobs belonging to a specific tenant.
 *
 */
export function listJobsByTenant(db: Database, tenantId: TenantId): Job[] {
  const data = readDataFile(db);
  return Object.values(data.jobs)
    .filter((j) => (j as Job).tenantId === (tenantId as string))
    .map((j) => j as Job);
}

/**
 * List jobs matching a given status, optionally limited to a count.
 *
 */
export function listJobsByStatus(
  db: Database,
  status: JobStatus,
  limit?: number,
): Job[] {
  const data = readDataFile(db);
  const matched = Object.values(data.jobs)
    .filter((j) => (j as Job).status === status)
    .map((j) => j as Job);

  return limit !== undefined ? matched.slice(0, limit) : matched;
}

/**
 * Delete jobs whose createdAt is older than the given date.
 * Returns the number of jobs removed.
 *
 */
export function deleteOldJobs(db: Database, olderThan: Date): number {
  const data = readDataFile(db);
  let count = 0;

  for (const [id, raw] of Object.entries(data.jobs)) {
    const job = raw as Job;
    if (new Date(job.createdAt) < olderThan) {
      delete data.jobs[id];
      count++;
    }
  }

  writeDataFile(db, data);
  return count;
}
