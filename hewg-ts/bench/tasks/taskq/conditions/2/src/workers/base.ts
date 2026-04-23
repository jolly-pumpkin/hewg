/**
 *
 * Base worker type and factory. All specialized workers extend BaseWorker.
 */

import type { Job } from "../types/job";
import type { WorkerConfig, WorkerId, WorkerResult } from "../types/worker";
import { WorkerStatus } from "../types/worker";

/**
 * Create a base worker with default job processing that returns a
 * not-implemented error. Specialized workers override processJob.
 */
export function createBaseWorker(config: WorkerConfig): BaseWorker {
  const worker: BaseWorker = {
    id: config.id,
    config,
    status: WorkerStatus.Idle,
    async processJob(_job: Job): Promise<WorkerResult> {
      return {
        success: false,
        error: "Base worker does not implement processJob",
        durationMs: 0,
      };
    },
  };

  console.log(`[worker] Created base worker ${config.id} (type: ${config.type})`);
  return worker;
}

/**
 * Log a worker lifecycle event, optionally associated with a job.
 */
export function logWorkerEvent(
  worker: BaseWorker,
  event: string,
  job?: Job,
): void {
  const jobInfo = job ? ` [job: ${job.id}]` : "";
  console.log(`[worker:${worker.id}] ${event}${jobInfo}`);
}
