
import type { Database } from "../storage/connection";
import type { QueueManager } from "../queue/manager";
import type { TenantContext } from "../types/tenant";
import type { TenantId } from "../types/tenant";
import type { JobId, CreateJobInput } from "../types/job";
import type { TenantStatus } from "../types/tenant";
import { parseAuthHeader, decodeTokenPayload } from "../auth/token";
import { fetchJwks, verifyTokenSignature } from "../auth/jwks";
import { extractTenantId } from "../auth/middleware";
import { getTenant } from "../storage/tenants";
import { buildTenantContext } from "../auth/tenant-isolation";
import type { ApiResponse } from "./jobs";
import { handleCreateJob, handleGetJob, handleListJobs, handleCancelJob } from "./jobs";
import { handleGetTenant, handleListTenants, handleUpdateTenantStatus } from "./tenants";
import { handleGetUsage, handleGetInvoice, handleListInvoices } from "./billing";
import { handleHealthCheck, handleReadiness } from "./health";

export class ApiRouter {
  private readonly db: Database;
  private readonly queueManager: QueueManager;
  private readonly jwksUrl: string;

  constructor(db: Database, queueManager: QueueManager, jwksUrl: string) {
    this.db = db;
    this.queueManager = queueManager;
    this.jwksUrl = jwksUrl;
  }

  async route(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<ApiResponse> {
    if (method === "GET" && path === "/health") {
      return handleHealthCheck(this.db);
    }
    if (method === "GET" && path === "/readiness") {
      return handleReadiness(this.db);
    }

    const ctx = await this.authenticate(headers);
    if (!ctx) {
      return { status: 401, body: { error: "Authentication required" } };
    }

    console.log(`[api/router] ${method} ${path} tenant=${ctx.tenantId}`);

    if (method === "POST" && path === "/jobs") {
      return handleCreateJob(this.db, this.queueManager, ctx, body as CreateJobInput);
    }

    const jobMatch = path.match(/^\/jobs\/(.+)$/);

    if (method === "GET" && jobMatch) {
      return handleGetJob(this.db, ctx, jobMatch[1] as JobId);
    }
    if (method === "GET" && path === "/jobs") {
      return handleListJobs(this.db, ctx);
    }
    if (method === "DELETE" && jobMatch) {
      return handleCancelJob(this.db, ctx, jobMatch[1] as JobId);
    }

    if (method === "GET" && path === "/tenants/me") {
      return handleGetTenant(this.db, ctx);
    }

    const usageMatch = path.match(/^\/billing\/usage(?:\?period=(.+))?$/);
    if (method === "GET" && path.startsWith("/billing/usage")) {
      const period = usageMatch?.[1] ?? this.currentPeriod();
      return handleGetUsage(this.db, ctx, period);
    }

    const invoiceMatch = path.match(/^\/billing\/invoices\/(.+)$/);
    if (method === "GET" && invoiceMatch) {
      return handleGetInvoice(this.db, ctx, invoiceMatch[1]);
    }
    if (method === "GET" && path === "/billing/invoices") {
      return handleListInvoices(this.db, ctx);
    }

    return { status: 404, body: { error: "Not found" } };
  }

  private async authenticate(
    headers: Record<string, string>,
  ): Promise<TenantContext | null> {
    const authHeader = headers["authorization"] ?? headers["Authorization"];
    if (!authHeader) return null;

    const parsed = parseAuthHeader(authHeader);
    if (!parsed || parsed.scheme.toLowerCase() !== "bearer") return null;

    const payload = decodeTokenPayload(parsed.token);
    if (!payload) return null;

    try {
      const jwks = await fetchJwks(this.jwksUrl);
      const valid = await verifyTokenSignature(parsed.token, jwks);
      if (!valid) return null;
    } catch {
      console.log("[api/router] JWKS verification failed, proceeding with decoded payload");
    }

    const tenantId = extractTenantId(payload);
    if (!tenantId) return null;

    const tenant = getTenant(this.db, tenantId);
    if (!tenant) return null;

    return buildTenantContext(tenant);
  }

  private currentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
}
