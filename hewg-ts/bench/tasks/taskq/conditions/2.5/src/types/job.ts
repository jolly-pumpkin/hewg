/**
 *
 * Core job types for the multi-tenant task queue.
 */

/**
 * Create a branded JobId from a raw string.
 */
export function toJobId(raw: string): JobId {
  return raw as JobId;
}

/**
 * Return true if the given status represents a terminal state.
 */
export function isTerminalStatus(status: JobStatus): boolean {
  return (
    status === JobStatus.Completed ||
    status === JobStatus.DeadLetter
  );
}

/**
 * Return true if the given status means the job is still actionable.
 */
export function isActionableStatus(status: JobStatus): boolean {
  return (
    status === JobStatus.Pending ||
    status === JobStatus.Running ||
    status === JobStatus.Failed
  );
}
