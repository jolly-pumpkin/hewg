/**
 * @hewg-module taskq/types/worker
 *
 * Worker configuration and result types for job processing.
 */

/** Branded string type for worker identifiers. */
export type WorkerId = string & { readonly __brand: "WorkerId" };

/** Runtime status of a worker process. */
export enum WorkerStatus {
  Idle = "idle",
  Busy = "busy",
  Draining = "draining",
  Stopped = "stopped",
}

/** The kind of work a worker handles. */
export enum WorkerType {
  Http = "http",
  Email = "email",
  Transform = "transform",
  Webhook = "webhook",
}

/** Static configuration for a worker instance. */
export interface WorkerConfig {
  readonly id: WorkerId;
  readonly type: WorkerType;
  readonly concurrency: number;
  readonly queueNames: string[];
  readonly retryDelay: number;
  readonly timeout: number;
}

/** Outcome returned by a worker after processing a single job. */
export interface WorkerResult {
  readonly success: boolean;
  readonly output?: unknown;
  readonly error?: string;
  readonly durationMs: number;
}

/**
 * Create a branded WorkerId from a raw string.
 * @hewg-module taskq/types/worker
 * @effects
 */
export function toWorkerId(raw: string): WorkerId {
  return raw as WorkerId;
}

/**
 * Return true if the worker is in a state where it can accept new jobs.
 * @hewg-module taskq/types/worker
 * @effects
 */
export function isWorkerAvailable(status: WorkerStatus): boolean {
  return status === WorkerStatus.Idle;
}

/**
 * Return true if the worker is in a state that should prevent new
 * job assignments (draining or fully stopped).
 * @hewg-module taskq/types/worker
 * @effects
 */
export function isWorkerShuttingDown(status: WorkerStatus): boolean {
  return (
    status === WorkerStatus.Draining ||
    status === WorkerStatus.Stopped
  );
}
