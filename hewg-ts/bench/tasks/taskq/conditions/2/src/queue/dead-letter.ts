/**
 *
 * Dead-letter queue operations for jobs that have exhausted retries
 * or failed in unrecoverable ways.
 */

import type { Database } from "../storage/connection";
import type { Job } from "../types/job";
import { JobStatus } from "../types/job";
import { updateJobStatus, listJobsByStatus } from "../storage/jobs";

/**
 * Move a failed job to the dead-letter queue by updating its status
 * and recording the reason for failure.
 */
export function moveToDeadLetter(
  db: Database,
  job: Job,
  reason: string,
): void {
  updateJobStatus(db, job.id, JobStatus.DeadLetter);
  job.status = JobStatus.DeadLetter;
  job.failedReason = reason;
  job.updatedAt = new Date();

  console.log(
    `[dead-letter] Job ${job.id} moved to dead-letter queue: ${reason}`,
  );
}

/**
 * Process all dead-letter jobs using the provided handler function.
 * The handler returns true if the job was successfully reprocessed.
 * Returns the count of successfully processed jobs.
 */
export function processDeadLetterQueue(
  db: Database,
  handler: (job: Job) => boolean,
): number {
  const deadLetterJobs = listJobsByStatus(db, JobStatus.DeadLetter);
  let processedCount = 0;

  for (const job of deadLetterJobs) {
    console.log(`[dead-letter] Processing dead-letter job ${job.id}`);

    const success = handler(job);
    if (success) {
      updateJobStatus(db, job.id, JobStatus.Completed);
      job.status = JobStatus.Completed;
      job.completedAt = new Date();
      job.updatedAt = new Date();
      processedCount += 1;

      console.log(`[dead-letter] Job ${job.id} successfully reprocessed`);
    } else {
      console.log(`[dead-letter] Job ${job.id} handler returned failure`);
    }
  }

  console.log(
    `[dead-letter] Processed ${processedCount}/${deadLetterJobs.length} dead-letter jobs`,
  );

  return processedCount;
}
