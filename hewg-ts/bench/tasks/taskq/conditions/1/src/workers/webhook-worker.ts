
import type { Job } from "../types/job";
import type { WorkerConfig, WorkerResult } from "../types/worker";
import { WorkerStatus } from "../types/worker";
import type { BaseWorker } from "./base";
import { logWorkerEvent } from "./base";

export interface WebhookJobPayload {
  readonly url: string;
  readonly event: string;
  readonly data: unknown;
  readonly headers?: Record<string, string>;
}

export interface WebhookWorker extends BaseWorker {
  readonly workerKind: "webhook";
}

export function createWebhookWorker(config: WorkerConfig): WebhookWorker {
  const worker: WebhookWorker = {
    id: config.id,
    config,
    status: WorkerStatus.Idle,
    workerKind: "webhook",
    async processJob(job: Job): Promise<WorkerResult> {
      return processWebhookJob(worker, job);
    },
  };

  console.log(`[webhook-worker] Created webhook worker ${config.id}`);
  return worker;
}

export async function processWebhookJob(
  worker: WebhookWorker,
  job: Job,
): Promise<WorkerResult> {
  const startTime = Date.now();
  logWorkerEvent(worker, "Processing webhook job", job);

  try {
    const payload = job.payload as WebhookJobPayload;
    if (!payload.url || !payload.event) {
      throw new Error("WebhookJobPayload requires url and event");
    }

    const webhookBody = {
      event: payload.event,
      data: payload.data,
      timestamp: new Date().toISOString(),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...payload.headers,
    };

    logWorkerEvent(worker, `Sending webhook to ${payload.url} (event: ${payload.event})`, job);

    const response = await fetch(payload.url, {
      method: "POST",
      headers,
      body: JSON.stringify(webhookBody),
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      logWorkerEvent(worker, `Webhook failed with status ${response.status}`, job);
      return {
        success: false,
        error: `Webhook returned ${response.status}: ${errorText.slice(0, 200)}`,
        durationMs,
      };
    }

    logWorkerEvent(worker, `Webhook delivered (${response.status})`, job);
    return {
      success: true,
      output: { status: response.status, event: payload.event },
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logWorkerEvent(worker, `Webhook error: ${message}`, job);
    return { success: false, error: message, durationMs };
  }
}
