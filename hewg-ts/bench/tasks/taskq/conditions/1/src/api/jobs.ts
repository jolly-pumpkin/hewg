
import type { Database } from "../storage/connection";
import type { QueueManager } from "../queue/manager";
import type { TenantContext } from "../types/tenant";
import type { TenantId } from "../types/tenant";
import type { CreateJobInput, JobId } from "../types/job";
import { JobStatus } from "../types/job";
import { getJob, listJobsByTenant, updateJobStatus } from "../storage/jobs";
import { assertTenantAccess } from "../auth/tenant-isolation";
import { validateCreateJobInput } from "../transforms/validate-job";

export interface ApiResponse {
  readonly status: number;
  readonly body: unknown;
}

export function handleCreateJob(
  db: Database,
  queue: QueueManager,
  ctx: TenantContext,
  input: CreateJobInput,
): ApiResponse {
  const validation = validateCreateJobInput(input);
  if (!validation.valid) {
    return { status: 400, body: { errors: validation.errors } };
  }

  if (input.tenantId !== (ctx.tenantId as string)) {
    return { status: 403, body: { error: "Cannot create jobs for another tenant" } };
  }

  try {
    const job = queue.submitJob(input);
    console.log(`[api/jobs] Created job ${job.id} for tenant ${ctx.tenantId}`);
    return { status: 201, body: job };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job submission failed";
    console.log(`[api/jobs] Submit failed for tenant ${ctx.tenantId}: ${message}`);
    return { status: 429, body: { error: message } };
  }
}

export function handleGetJob(
  db: Database,
  ctx: TenantContext,
  jobId: JobId,
): ApiResponse {
  const job = getJob(db, jobId);
  if (!job) {
    return { status: 404, body: { error: "Job not found" } };
  }

  try {
    assertTenantAccess(ctx, job.tenantId as TenantId);
  } catch {
    return { status: 403, body: { error: "Access denied" } };
  }

  console.log(`[api/jobs] Retrieved job ${jobId} for tenant ${ctx.tenantId}`);
  return { status: 200, body: job };
}

export function handleListJobs(
  db: Database,
  ctx: TenantContext,
): ApiResponse {
  const jobs = listJobsByTenant(db, ctx.tenantId);
  console.log(`[api/jobs] Listed ${jobs.length} jobs for tenant ${ctx.tenantId}`);
  return { status: 200, body: jobs };
}

export function handleCancelJob(
  db: Database,
  ctx: TenantContext,
  jobId: JobId,
): ApiResponse {
  const job = getJob(db, jobId);
  if (!job) {
    return { status: 404, body: { error: "Job not found" } };
  }

  try {
    assertTenantAccess(ctx, job.tenantId as TenantId);
  } catch {
    return { status: 403, body: { error: "Access denied" } };
  }

  if (job.status === JobStatus.Completed || job.status === JobStatus.DeadLetter) {
    return { status: 409, body: { error: "Job is already in a terminal state" } };
  }

  updateJobStatus(db, jobId, JobStatus.Failed, "Cancelled by user");
  console.log(`[api/jobs] Cancelled job ${jobId} for tenant ${ctx.tenantId}`);
  return { status: 200, body: { message: "Job cancelled" } };
}
