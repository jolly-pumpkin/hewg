/**
 * @hewg-module taskq/types/job
 *
 * Core job types for the multi-tenant task queue.
 */

/** Branded string type for job identifiers. */
export type JobId = string & { readonly __brand: "JobId" };

/** Lifecycle status of a job in the queue. */
export enum JobStatus {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  DeadLetter = "dead-letter",
}

/** Priority tiers for job scheduling. */
export enum JobPriority {
  Low = 0,
  Normal = 1,
  High = 2,
  Critical = 3,
}

/** A single unit of work tracked by the queue. */
export interface Job {
  readonly id: JobId;
  readonly tenantId: string;
  readonly queueName: string;
  readonly payload: unknown;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  readonly maxAttempts: number;
  readonly createdAt: Date;
  updatedAt: Date;
  scheduledAt?: Date;
  completedAt?: Date;
  failedReason?: string;
  result?: unknown;
}

/** Input shape accepted when creating a new job. */
export interface CreateJobInput {
  readonly tenantId: string;
  readonly queueName: string;
  readonly payload: unknown;
  readonly priority?: JobPriority;
  readonly maxAttempts?: number;
  readonly scheduledAt?: Date;
}

/**
 * Create a branded JobId from a raw string.
 * @hewg-module taskq/types/job
 * @effects
 */
export function toJobId(raw: string): JobId {
  return raw as JobId;
}

/**
 * Return true if the given status represents a terminal state.
 * @hewg-module taskq/types/job
 * @effects
 */
export function isTerminalStatus(status: JobStatus): boolean {
  return (
    status === JobStatus.Completed ||
    status === JobStatus.DeadLetter
  );
}

/**
 * Return true if the given status means the job is still actionable.
 * @hewg-module taskq/types/job
 * @effects
 */
export function isActionableStatus(status: JobStatus): boolean {
  return (
    status === JobStatus.Pending ||
    status === JobStatus.Running ||
    status === JobStatus.Failed
  );
}
