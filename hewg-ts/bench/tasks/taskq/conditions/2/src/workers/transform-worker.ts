/**
 *
 * Worker that runs pure data transformations. No network or
 * filesystem access -- only logging.
 */

import type { Job } from "../types/job";
import type { WorkerConfig, WorkerResult } from "../types/worker";
import { WorkerStatus } from "../types/worker";
import type { BaseWorker } from "./base";
import { logWorkerEvent } from "./base";

/**
 * Create a transform worker that runs pure data transformations.
 */
export function createTransformWorker(config: WorkerConfig): TransformWorker {
  const worker: TransformWorker = {
    id: config.id,
    config,
    status: WorkerStatus.Idle,
    workerKind: "transform",
    async processJob(job: Job): Promise<WorkerResult> {
      return processTransformJob(worker, job);
    },
  };

  console.log(`[transform-worker] Created transform worker ${config.id}`);
  return worker;
}

/**
 * Process a single job by running a data transformation.
 * Supports "uppercase", "lowercase", "reverse", and "identity" transforms.
 */
export async function processTransformJob(
  worker: TransformWorker,
  job: Job,
): Promise<WorkerResult> {
  const startTime = Date.now();
  logWorkerEvent(worker, "Processing transform job", job);

  try {
    const payload = job.payload as TransformJobPayload;
    if (!payload.transformType) {
      throw new Error("TransformJobPayload requires transformType");
    }

    const input = payload.inputData;
    let output: unknown;

    switch (payload.transformType) {
      case "uppercase":
        output = typeof input === "string" ? input.toUpperCase() : input;
        break;
      case "lowercase":
        output = typeof input === "string" ? input.toLowerCase() : input;
        break;
      case "reverse":
        output = typeof input === "string"
          ? input.split("").reverse().join("")
          : Array.isArray(input)
            ? [...input].reverse()
            : input;
        break;
      case "identity":
        output = input;
        break;
      default:
        throw new Error(`Unknown transform type: ${payload.transformType}`);
    }

    const durationMs = Date.now() - startTime;
    logWorkerEvent(
      worker,
      `Transform "${payload.transformType}" completed`,
      job,
    );

    return { success: true, output, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logWorkerEvent(worker, `Transform error: ${message}`, job);
    return { success: false, error: message, durationMs };
  }
}
