/**
 *
 * Health and readiness check endpoints for load balancer probes
 * and monitoring systems.
 */

import type { Database } from "../storage/connection";
import { countActiveJobs } from "../storage/queries";
import type { ApiResponse } from "./jobs";

const startedAt = Date.now();

/**
 * Handle a GET /health request. Reports the service's current
 * health status including uptime and database connectivity.
 * Always returns 200 unless the database connection is lost.
 *
 */
export function handleHealthCheck(db: Database): ApiResponse {
  const uptimeMs = Date.now() - startedAt;
  const healthy = db.connected;

  const body = {
    status: healthy ? "healthy" : "degraded",
    uptime: uptimeMs,
    database: db.connected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  };

  if (!healthy) {
    console.log("[api/health] Health check: degraded — database disconnected");
    return { status: 503, body };
  }

  console.log(`[api/health] Health check: healthy, uptime=${uptimeMs}ms`);
  return { status: 200, body };
}

/**
 * Handle a GET /readiness request. Checks whether the service is
 * ready to accept traffic by verifying database connectivity and
 * running a lightweight query.
 *
 */
export function handleReadiness(db: Database): ApiResponse {
  if (!db.connected) {
    console.log("[api/health] Readiness check: not ready — database disconnected");
    return {
      status: 503,
      body: { ready: false, reason: "Database not connected" },
    };
  }

  try {
    const activeJobs = countActiveJobs(db);
    console.log(`[api/health] Readiness check: ready, activeJobs=${activeJobs}`);
    return {
      status: 200,
      body: {
        ready: true,
        activeJobs,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.log(`[api/health] Readiness check failed: ${message}`);
    return {
      status: 503,
      body: { ready: false, reason: message },
    };
  }
}
