/**
 *
 * Worker that processes jobs by simulating SMTP email delivery
 * over a TCP connection.
 */

import type { Job } from "../types/job";
import type { WorkerConfig, WorkerResult } from "../types/worker";
import { WorkerStatus } from "../types/worker";
import type { BaseWorker } from "./base";
import { logWorkerEvent } from "./base";

/**
 * Create an email worker that processes jobs by simulating SMTP delivery.
 */
export function createEmailWorker(config: WorkerConfig): EmailWorker {
  const worker: EmailWorker = {
    id: config.id,
    config,
    status: WorkerStatus.Idle,
    workerKind: "email",
    async processJob(job: Job): Promise<WorkerResult> {
      return processEmailJob(worker, job);
    },
  };

  console.log(`[email-worker] Created email worker ${config.id}`);
  return worker;
}

/**
 * Process a single job by simulating an SMTP email send over TCP.
 * Validates the payload and simulates connection, handshake, and delivery.
 */
export async function processEmailJob(
  worker: EmailWorker,
  job: Job,
): Promise<WorkerResult> {
  const startTime = Date.now();
  logWorkerEvent(worker, "Processing email job", job);

  try {
    const payload = job.payload as EmailJobPayload;
    if (!payload.to || !payload.from || !payload.subject) {
      throw new Error("EmailJobPayload requires to, from, and subject");
    }

    logWorkerEvent(worker, `Connecting to SMTP server for ${payload.to}`, job);

    // Simulate SMTP handshake and delivery
    const smtpLog: string[] = [];
    smtpLog.push("220 smtp.example.com ESMTP ready");
    smtpLog.push(`MAIL FROM:<${payload.from}>`);
    smtpLog.push("250 OK");
    smtpLog.push(`RCPT TO:<${payload.to}>`);
    smtpLog.push("250 OK");
    smtpLog.push("DATA");
    smtpLog.push("354 Start mail input");
    smtpLog.push(`Subject: ${payload.subject}`);
    smtpLog.push("250 OK: message queued");
    smtpLog.push("QUIT");

    const durationMs = Date.now() - startTime;
    logWorkerEvent(worker, `Email delivered to ${payload.to}`, job);

    return {
      success: true,
      output: { recipient: payload.to, smtpLog },
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logWorkerEvent(worker, `Email delivery error: ${message}`, job);
    return { success: false, error: message, durationMs };
  }
}
