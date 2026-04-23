
import type { Database } from "../storage/connection";
import type { TenantContext, TenantStatus } from "../types/tenant";
import { getTenant, listTenants, updateTenantStatus } from "../storage/tenants";
import type { ApiResponse } from "./jobs";

export function handleGetTenant(
  db: Database,
  ctx: TenantContext,
): ApiResponse {
  const tenant = getTenant(db, ctx.tenantId);
  if (!tenant) {
    console.log(`[api/tenants] Tenant ${ctx.tenantId} not found in database`);
    return { status: 404, body: { error: "Tenant not found" } };
  }

  console.log(`[api/tenants] Retrieved tenant ${ctx.tenantId}`);
  return { status: 200, body: tenant };
}

export function handleListTenants(db: Database): ApiResponse {
  const tenants = listTenants(db);
  console.log(`[api/tenants] Listed ${tenants.length} tenants`);
  return { status: 200, body: tenants };
}

export function handleUpdateTenantStatus(
  db: Database,
  ctx: TenantContext,
  status: TenantStatus,
): ApiResponse {
  const tenant = getTenant(db, ctx.tenantId);
  if (!tenant) {
    return { status: 404, body: { error: "Tenant not found" } };
  }

  const validStatuses = ["active", "suspended", "deactivated"];
  if (!validStatuses.includes(status)) {
    return { status: 400, body: { error: `Invalid status: ${status}` } };
  }

  updateTenantStatus(db, ctx.tenantId, status);
  console.log(`[api/tenants] Updated tenant ${ctx.tenantId} status to ${status}`);
  return { status: 200, body: { message: `Status updated to ${status}` } };
}
