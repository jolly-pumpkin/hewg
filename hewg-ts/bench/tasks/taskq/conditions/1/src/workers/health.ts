
import { WorkerStatus } from "../types/worker";
import type { BaseWorker } from "./base";
import type { WorkerPool } from "./pool";

export interface HealthStatus {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly lastCheck: Date;
  readonly message: string;
}

export interface PoolHealthReport {
  readonly overall: "healthy" | "degraded" | "unhealthy";
  readonly checkedAt: Date;
  readonly workerStatuses: Record<string, HealthStatus>;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly unhealthyCount: number;
}

export function checkWorkerHealth(worker: BaseWorker): HealthStatus {
  const now = new Date(Date.now());
  let status: HealthStatus["status"];
  let message: string;

  switch (worker.status) {
    case WorkerStatus.Idle:
      status = "healthy";
      message = "Worker is idle and ready for jobs";
      break;
    case WorkerStatus.Busy:
      status = "healthy";
      message = "Worker is actively processing a job";
      break;
    case WorkerStatus.Draining:
      status = "degraded";
      message = "Worker is draining and will not accept new jobs";
      break;
    case WorkerStatus.Stopped:
      status = "unhealthy";
      message = "Worker is stopped";
      break;
    default:
      status = "unhealthy";
      message = `Worker is in unknown status: ${worker.status}`;
  }

  const healthStatus: HealthStatus = { status, lastCheck: now, message };

  console.log(
    `[health] Worker ${worker.id}: ${status} - ${message}`,
  );

  return healthStatus;
}

export function checkPoolHealth(pool: WorkerPool): PoolHealthReport {
  const now = new Date(Date.now());
  const stats = pool.getPoolStats();
  const workerStatuses: Record<string, HealthStatus> = {};

  // Derive counts from pool stats since we cannot iterate workers directly
  const healthyCount = stats.idle + stats.busy;
  const degradedCount = stats.draining;
  const unhealthyCount = stats.stopped;

  let overall: PoolHealthReport["overall"];
  if (unhealthyCount > 0 && healthyCount === 0) {
    overall = "unhealthy";
  } else if (degradedCount > 0 || unhealthyCount > 0) {
    overall = "degraded";
  } else {
    overall = "healthy";
  }

  const report: PoolHealthReport = {
    overall,
    checkedAt: now,
    workerStatuses,
    healthyCount,
    degradedCount,
    unhealthyCount,
  };

  console.log(
    `[health] Pool health: ${overall} (healthy: ${healthyCount}, degraded: ${degradedCount}, unhealthy: ${unhealthyCount})`,
  );

  return report;
}
