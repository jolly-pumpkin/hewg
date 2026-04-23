
import type { Database } from "../storage/connection";
import type { Job } from "../types/job";
import { JobStatus } from "../types/job";
import { listJobsByStatus, updateJobStatus } from "../storage/jobs";
import { comparePriority } from "../transforms/priority";
import type { ConcurrencyLimiter } from "./concurrency-limiter";

export function dispatchNextJob(
  db: Database,
  queueName: string,
  limiter: ConcurrencyLimiter,
): Job | null {
  if (limiter.isAtCapacity(queueName)) {
    console.log(`[dispatch] Queue "${queueName}" is at concurrency capacity`);
    return null;
  }

  const pendingJobs = listJobsByStatus(db, JobStatus.Pending);
  const queueJobs = pendingJobs.filter((j) => j.queueName === queueName);

  if (queueJobs.length === 0) {
    console.log(`[dispatch] No pending jobs in queue "${queueName}"`);
    return null;
  }

  queueJobs.sort((a, b) => comparePriority(b, a));

  const job = queueJobs[0];

  if (!limiter.tryAcquire(queueName)) {
    console.log(`[dispatch] Failed to acquire concurrency slot for "${queueName}"`);
    return null;
  }

  updateJobStatus(db, job.id, JobStatus.Running);
  job.status = JobStatus.Running;
  job.attempts += 1;
  job.updatedAt = new Date();

  console.log(
    `[dispatch] Dispatched job ${job.id} from queue "${queueName}" (priority: ${job.priority})`,
  );

  return job;
}

export function dispatchBatch(
  db: Database,
  queueName: string,
  limiter: ConcurrencyLimiter,
  batchSize: number,
): Job[] {
  const dispatched: Job[] = [];

  for (let i = 0; i < batchSize; i++) {
    const job = dispatchNextJob(db, queueName, limiter);
    if (!job) {
      break;
    }
    dispatched.push(job);
  }

  console.log(
    `[dispatch] Batch dispatched ${dispatched.length}/${batchSize} jobs from "${queueName}"`,
  );

  return dispatched;
}
