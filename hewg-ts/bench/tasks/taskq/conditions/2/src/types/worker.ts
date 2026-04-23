/**
 *
 * Worker configuration and result types for job processing.
 */

/**
 * Create a branded WorkerId from a raw string.
 */
export function toWorkerId(raw: string): WorkerId {
  return raw as WorkerId;
}

/**
 * Return true if the worker is in a state where it can accept new jobs.
 */
export function isWorkerAvailable(status: WorkerStatus): boolean {
  return status === WorkerStatus.Idle;
}

/**
 * Return true if the worker is in a state that should prevent new
 * job assignments (draining or fully stopped).
 */
export function isWorkerShuttingDown(status: WorkerStatus): boolean {
  return (
    status === WorkerStatus.Draining ||
    status === WorkerStatus.Stopped
  );
}
