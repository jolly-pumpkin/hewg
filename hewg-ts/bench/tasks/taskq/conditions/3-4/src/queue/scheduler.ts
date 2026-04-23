/**
 * @hewg-module taskq/queue/scheduler
 *
 * Job scheduling operations: create, reschedule, and cancel jobs.
 * Interacts with the database through the storage layer.
 */

import type { Database } from "../storage/connection";
import type { CreateJobInput, Job, JobId } from "../types/job";
import { JobStatus, JobPriority, toJobId } from "../types/job";
import { insertJob, getJob, updateJobStatus } from "../storage/jobs";
import { validateCreateJobInput } from "../transforms/validate-job";

let jobCounter = 0;

/**
 * Validate and schedule a new job, inserting it into the database.
 * Throws if the input fails validation.
 * @hewg-module taskq/queue/scheduler
 * @effects fs.read, fs.write, time.read
 */
export function scheduleJob(db: Database, input: CreateJobInput): Job {
  const validation = validateCreateJobInput(input);
  if (!validation.valid) {
    throw new Error(`Invalid job input: ${validation.errors.join(", ")}`);
  }

  const now = new Date();
  jobCounter += 1;

  const job: Job = {
    id: toJobId(`job_${Date.now()}_${jobCounter}`),
    tenantId: input.tenantId,
    queueName: input.queueName,
    payload: input.payload,
    status: JobStatus.Pending,
    priority: input.priority ?? JobPriority.Normal,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    createdAt: now,
    updatedAt: now,
    scheduledAt: input.scheduledAt,
  };

  insertJob(db, job);
  return job;
}

/**
 * Reschedule an existing job by updating its scheduledAt timestamp.
 * Throws if the job is not found.
 * @hewg-module taskq/queue/scheduler
 * @effects fs.read, fs.write
 */
export function rescheduleJob(
  db: Database,
  jobId: JobId,
  scheduledAt: Date,
): void {
  const job = getJob(db, jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }
  job.scheduledAt = scheduledAt;
  job.updatedAt = new Date();
  updateJobStatus(db, jobId, job.status);
}

/**
 * Cancel a pending job by marking it as completed.
 * Returns true if the job was cancelled, false if it was not in a
 * cancellable state or not found.
 * @hewg-module taskq/queue/scheduler
 * @effects fs.read, fs.write
 */
export function cancelJob(db: Database, jobId: JobId): boolean {
  const job = getJob(db, jobId);
  if (!job) {
    return false;
  }
  if (job.status !== JobStatus.Pending) {
    return false;
  }
  updateJobStatus(db, jobId, JobStatus.Completed);
  return true;
}
