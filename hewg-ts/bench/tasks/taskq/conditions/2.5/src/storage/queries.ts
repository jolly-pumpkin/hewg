/**
 *
 * Read-only aggregate queries against the simulated JSON database.
 */

import type { Job, JobStatus } from "../types/job";
import { JobPriority } from "../types/job";
import type { TenantId } from "../types/tenant";
import type { Database } from "./connection";
import { readDataFile } from "./connection";

/**
 * Count the total number of jobs belonging to a tenant.
 *
 */
export function countJobsByTenant(db: Database, tenantId: TenantId): number {
  const data = readDataFile(db);
  return Object.values(data.jobs).filter(
    (j) => (j as Job).tenantId === (tenantId as string),
  ).length;
}

/**
 * Count all jobs that are currently in "pending" or "running" status.
 *
 */
export function countActiveJobs(db: Database): number {
  const data = readDataFile(db);
  return Object.values(data.jobs).filter((j) => {
    const status = (j as Job).status;
    return status === "pending" || status === "running";
  }).length;
}

/**
 * Return the oldest job in "pending" status, optionally filtered
 * by queue name. Returns null if no pending jobs exist.
 *
 */
export function getOldestPendingJob(
  db: Database,
  queueName?: string,
): Job | null {
  const data = readDataFile(db);
  const pending = Object.values(data.jobs)
    .map((j) => j as Job)
    .filter((j) => j.status === "pending")
    .filter((j) => (queueName ? j.queueName === queueName : true));

  if (pending.length === 0) return null;

  pending.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return pending[0];
}

/**
 * Return jobs from a specific queue ordered by priority (highest first),
 * then by creation date (oldest first), limited to the requested count.
 *
 */
export function getJobsByPriorityOrder(
  db: Database,
  queueName: string,
  limit: number,
): Job[] {
  const data = readDataFile(db);
  const jobs = Object.values(data.jobs)
    .map((j) => j as Job)
    .filter((j) => j.queueName === queueName && j.status === "pending");

  jobs.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  });

  return jobs.slice(0, limit);
}
