/**
 * @hewg-module taskq/queue/manager
 *
 * High-level queue manager that orchestrates scheduling, dispatching,
 * and statistics for a multi-tenant task queue.
 */

import type { Database } from "../storage/connection";
import type { CreateJobInput, Job } from "../types/job";
import { JobStatus } from "../types/job";
import { listJobsByStatus } from "../storage/jobs";
import { ConcurrencyLimiter } from "./concurrency-limiter";
import { RateLimiter } from "./rate-limiter";
import { scheduleJob } from "./scheduler";
import { dispatchNextJob } from "./dispatch";
import { moveToDeadLetter } from "./dead-letter";

/** Aggregated statistics for a single named queue. */
export interface QueueStats {
  readonly pending: number;
  readonly running: number;
  readonly completed: number;
  readonly failed: number;
  readonly deadLetter: number;
}

/**
 * Orchestrates job submission, dispatching, and queue statistics.
 */
export class QueueManager {
  private readonly db: Database;
  private readonly concurrencyLimiter: ConcurrencyLimiter;
  private readonly rateLimiter: RateLimiter;

  constructor(
    db: Database,
    concurrencyLimiter: ConcurrencyLimiter,
    rateLimiter: RateLimiter,
  ) {
    this.db = db;
    this.concurrencyLimiter = concurrencyLimiter;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Submit a new job to the queue. Validates input and persists the job.
   * Checks rate limits before accepting the submission.
   * @hewg-module taskq/queue/manager
   * @effects fs.read, fs.write, log, time.read
   */
  submitJob(input: CreateJobInput): Job {
    const rateLimitKey = `${input.tenantId}:${input.queueName}`;
    if (!this.rateLimiter.tryConsume(rateLimitKey)) {
      throw new Error(
        `Rate limit exceeded for tenant ${input.tenantId} on queue ${input.queueName}`,
      );
    }

    const job = scheduleJob(this.db, input);
    console.log(
      `[manager] Job ${job.id} submitted to queue "${job.queueName}"`,
    );
    return job;
  }

  /**
   * Process the given queue: dispatch pending jobs and return the count
   * of jobs that were dispatched in this cycle.
   * @hewg-module taskq/queue/manager
   * @effects fs.read, fs.write, log
   */
  processQueue(queueName: string): number {
    let dispatched = 0;

    while (true) {
      const job = dispatchNextJob(
        this.db,
        queueName,
        this.concurrencyLimiter,
      );
      if (!job) {
        break;
      }
      dispatched += 1;
    }

    console.log(
      `[manager] Processed queue "${queueName}": ${dispatched} jobs dispatched`,
    );
    return dispatched;
  }

  /**
   * Collect and return statistics for the named queue.
   * @hewg-module taskq/queue/manager
   * @effects fs.read, log
   */
  getQueueStats(queueName: string): QueueStats {
    const countByStatus = (status: JobStatus): number => {
      const jobs = listJobsByStatus(this.db, status);
      return jobs.filter((j) => j.queueName === queueName).length;
    };

    const stats: QueueStats = {
      pending: countByStatus(JobStatus.Pending),
      running: countByStatus(JobStatus.Running),
      completed: countByStatus(JobStatus.Completed),
      failed: countByStatus(JobStatus.Failed),
      deadLetter: countByStatus(JobStatus.DeadLetter),
    };

    console.log(
      `[manager] Queue "${queueName}" stats: ${JSON.stringify(stats)}`,
    );
    return stats;
  }

  /**
   * Drain all pending jobs from a queue by moving them to dead-letter.
   * Used during graceful shutdown or queue decommissioning.
   * @hewg-module taskq/queue/manager
   * @effects fs.read, fs.write, log
   */
  drainQueue(queueName: string): void {
    const pendingJobs = listJobsByStatus(this.db, JobStatus.Pending);
    const queueJobs = pendingJobs.filter((j) => j.queueName === queueName);

    for (const job of queueJobs) {
      moveToDeadLetter(this.db, job, "Queue drained");
    }

    console.log(
      `[manager] Drained queue "${queueName}": ${queueJobs.length} jobs moved to dead-letter`,
    );
  }
}
