/**
 * @hewg-module taskq/workers/pool
 *
 * Worker pool that manages a collection of workers, assigns jobs,
 * and tracks pool-level statistics.
 */

import type { Job } from "../types/job";
import type { WorkerId, WorkerResult } from "../types/worker";
import { WorkerStatus } from "../types/worker";
import type { BaseWorker } from "./base";
import { logWorkerEvent } from "./base";

/** Aggregated statistics for a worker pool. */
export interface PoolStats {
  readonly total: number;
  readonly idle: number;
  readonly busy: number;
  readonly draining: number;
  readonly stopped: number;
}

/**
 * A pool of workers that can be assigned jobs.
 */
export class WorkerPool {
  private readonly workers: Map<WorkerId, BaseWorker> = new Map();

  /**
   * Add a worker to the pool.
   * @hewg-module taskq/workers/pool
   * @effects log
   */
  addWorker(worker: BaseWorker): void {
    this.workers.set(worker.id, worker);
    console.log(`[pool] Added worker ${worker.id} to pool`);
  }

  /**
   * Remove a worker from the pool by its ID.
   * Returns true if the worker was found and removed.
   * @hewg-module taskq/workers/pool
   * @effects log
   */
  removeWorker(id: WorkerId): boolean {
    const removed = this.workers.delete(id);
    if (removed) {
      console.log(`[pool] Removed worker ${id} from pool`);
    }
    return removed;
  }

  /**
   * Find an idle worker that handles the given queue name.
   * Returns null if no idle worker is available.
   * @hewg-module taskq/workers/pool
   * @effects
   */
  getIdleWorker(queueName: string): BaseWorker | null {
    for (const worker of this.workers.values()) {
      if (
        worker.status === WorkerStatus.Idle &&
        worker.config.queueNames.includes(queueName)
      ) {
        return worker;
      }
    }
    return null;
  }

  /**
   * Assign a job to a worker, process it, and return the result.
   * Manages the worker's status lifecycle during processing.
   * Uses setTimeout to simulate realistic async processing delays.
   * @hewg-module taskq/workers/pool
   * @effects log, time.sleep
   */
  async assignJob(worker: BaseWorker, job: Job): Promise<WorkerResult> {
    logWorkerEvent(worker, "Assigned job", job);
    worker.status = WorkerStatus.Busy;

    try {
      // Simulate a small processing delay
      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      const result = await worker.processJob(job);
      worker.status = WorkerStatus.Idle;

      logWorkerEvent(
        worker,
        result.success ? "Job completed successfully" : `Job failed: ${result.error}`,
        job,
      );

      return result;
    } catch (error) {
      worker.status = WorkerStatus.Idle;
      const message = error instanceof Error ? error.message : String(error);
      logWorkerEvent(worker, `Job processing threw: ${message}`, job);

      return {
        success: false,
        error: message,
        durationMs: 0,
      };
    }
  }

  /**
   * Return aggregated statistics about the workers in the pool.
   * @hewg-module taskq/workers/pool
   * @effects log
   */
  getPoolStats(): PoolStats {
    let idle = 0;
    let busy = 0;
    let draining = 0;
    let stopped = 0;

    for (const worker of this.workers.values()) {
      switch (worker.status) {
        case WorkerStatus.Idle:
          idle++;
          break;
        case WorkerStatus.Busy:
          busy++;
          break;
        case WorkerStatus.Draining:
          draining++;
          break;
        case WorkerStatus.Stopped:
          stopped++;
          break;
      }
    }

    const stats: PoolStats = {
      total: this.workers.size,
      idle,
      busy,
      draining,
      stopped,
    };

    console.log(`[pool] Stats: ${JSON.stringify(stats)}`);
    return stats;
  }
}
