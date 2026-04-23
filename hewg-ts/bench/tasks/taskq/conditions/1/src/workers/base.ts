
import type { Job } from "../types/job";
import type { WorkerConfig, WorkerId, WorkerResult } from "../types/worker";
import { WorkerStatus } from "../types/worker";

export interface BaseWorker {
  readonly id: WorkerId;
  readonly config: WorkerConfig;
  status: WorkerStatus;
  processJob(job: Job): Promise<WorkerResult>;
}

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

export function logWorkerEvent(
  worker: BaseWorker,
  event: string,
  job?: Job,
): void {
  const jobInfo = job ? ` [job: ${job.id}]` : "";
  console.log(`[worker:${worker.id}] ${event}${jobInfo}`);
}
