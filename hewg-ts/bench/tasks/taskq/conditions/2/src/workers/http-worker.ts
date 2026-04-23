/**
 *
 * Worker that processes jobs by making HTTP requests.
 */

import type { Job } from "../types/job";
import type { WorkerConfig, WorkerResult } from "../types/worker";
import { WorkerStatus } from "../types/worker";
import type { BaseWorker } from "./base";
import { logWorkerEvent } from "./base";

/**
 * Create an HTTP worker that processes jobs by making fetch requests.
 */
export function createHttpWorker(config: WorkerConfig): HttpWorker {
  const worker: HttpWorker = {
    id: config.id,
    config,
    status: WorkerStatus.Idle,
    workerKind: "http",
    async processJob(job: Job): Promise<WorkerResult> {
      return processHttpJob(worker, job);
    },
  };

  console.log(`[http-worker] Created HTTP worker ${config.id}`);
  return worker;
}

/**
 * Process a single job by making an HTTP request from the job payload.
 * The payload must conform to HttpJobPayload.
 */
export async function processHttpJob(
  worker: HttpWorker,
  job: Job,
): Promise<WorkerResult> {
  const startTime = Date.now();
  logWorkerEvent(worker, "Processing HTTP job", job);

  try {
    const payload = job.payload as HttpJobPayload;
    if (!payload.url || !payload.method) {
      throw new Error("HttpJobPayload requires url and method");
    }

    const response = await fetch(payload.url, {
      method: payload.method,
      headers: payload.headers,
      body: payload.body ? JSON.stringify(payload.body) : undefined,
    });

    const responseBody = await response.text();
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      logWorkerEvent(worker, `HTTP request failed with status ${response.status}`, job);
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
        durationMs,
      };
    }

    logWorkerEvent(worker, `HTTP request succeeded (${response.status})`, job);
    return {
      success: true,
      output: { status: response.status, body: responseBody },
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logWorkerEvent(worker, `HTTP request error: ${message}`, job);
    return { success: false, error: message, durationMs };
  }
}
