/**
 *
 * Human-readable formatting helpers for CLI output and logging.
 */

import type { Job } from "../types/job";
import type { WorkerId } from "../types/worker";
import { WorkerStatus } from "../types/worker";
import type { UsageRecord, BillingPlan } from "../types/billing";

/**
 * Format a one-line summary of a job suitable for table output.
 * Includes id, queue, status, priority, and attempt count.
 */
export function formatJobSummary(job: Job): string {
  const id = job.id.slice(0, 8);
  const attempts = `${job.attempts}/${job.maxAttempts}`;
  const age = formatDuration(Date.now() - job.createdAt.getTime());
  const parts = [
    `[${id}]`,
    job.queueName.padEnd(20),
    String(job.status).padEnd(12),
    `pri=${job.priority}`,
    `att=${attempts}`,
    `age=${age}`,
  ];
  if (job.failedReason) {
    parts.push(`err="${job.failedReason}"`);
  }
  return parts.join("  ");
}

/**
 * Format a worker status line for monitoring dashboards.
 */
export function formatWorkerStatus(
  workerId: WorkerId,
  status: WorkerStatus,
  activeJobs: number,
): string {
  const id = (workerId as string).slice(0, 8);
  const icon =
    status === WorkerStatus.Idle
      ? "IDLE"
      : status === WorkerStatus.Busy
        ? "BUSY"
        : status === WorkerStatus.Draining
          ? "DRAIN"
          : "STOP";
  return `worker:${id}  ${icon.padEnd(6)} active=${activeJobs}`;
}

/**
 * Format a usage summary comparing actual usage against plan limits.
 */
export function formatUsageSummary(
  usage: UsageRecord,
  plan: BillingPlan,
): string {
  const pct = plan.includedJobs > 0
    ? ((usage.jobsCompleted / plan.includedJobs) * 100).toFixed(1)
    : "N/A";
  const lines = [
    `Period: ${usage.period}`,
    `Plan:   ${plan.name} (${plan.includedJobs} included)`,
    `Jobs:   ${usage.jobsSubmitted} submitted, ${usage.jobsCompleted} completed, ${usage.jobsFailed} failed`,
    `Usage:  ${pct}% of included quota`,
    `Time:   ${formatDuration(usage.totalDurationMs)} total processing`,
  ];
  return lines.join("\n");
}

/**
 * Format a millisecond duration into a human-readable string.
 * Produces output like "2h 14m 8s" or "350ms" for sub-second values.
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60_000) % 60;
  const hours = Math.floor(ms / 3_600_000);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.join(" ") || "0s";
}
