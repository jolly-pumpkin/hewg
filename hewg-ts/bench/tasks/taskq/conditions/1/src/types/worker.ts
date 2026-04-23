
export type WorkerId = string & { readonly __brand: "WorkerId" };

export enum WorkerStatus {
  Idle = "idle",
  Busy = "busy",
  Draining = "draining",
  Stopped = "stopped",
}

export enum WorkerType {
  Http = "http",
  Email = "email",
  Transform = "transform",
  Webhook = "webhook",
}

export interface WorkerConfig {
  readonly id: WorkerId;
  readonly type: WorkerType;
  readonly concurrency: number;
  readonly queueNames: string[];
  readonly retryDelay: number;
  readonly timeout: number;
}

export interface WorkerResult {
  readonly success: boolean;
  readonly output?: unknown;
  readonly error?: string;
  readonly durationMs: number;
}

export function toWorkerId(raw: string): WorkerId {
  return raw as WorkerId;
}

export function isWorkerAvailable(status: WorkerStatus): boolean {
  return status === WorkerStatus.Idle;
}

export function isWorkerShuttingDown(status: WorkerStatus): boolean {
  return (
    status === WorkerStatus.Draining ||
    status === WorkerStatus.Stopped
  );
}
