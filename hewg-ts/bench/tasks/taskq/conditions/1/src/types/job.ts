
export type JobId = string & { readonly __brand: "JobId" };

export enum JobStatus {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed",
  DeadLetter = "dead-letter",
}

export enum JobPriority {
  Low = 0,
  Normal = 1,
  High = 2,
  Critical = 3,
}

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

export interface CreateJobInput {
  readonly tenantId: string;
  readonly queueName: string;
  readonly payload: unknown;
  readonly priority?: JobPriority;
  readonly maxAttempts?: number;
  readonly scheduledAt?: Date;
}

export function toJobId(raw: string): JobId {
  return raw as JobId;
}

export function isTerminalStatus(status: JobStatus): boolean {
  return (
    status === JobStatus.Completed ||
    status === JobStatus.DeadLetter
  );
}

export function isActionableStatus(status: JobStatus): boolean {
  return (
    status === JobStatus.Pending ||
    status === JobStatus.Running ||
    status === JobStatus.Failed
  );
}
