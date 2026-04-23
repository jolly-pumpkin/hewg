/**
 * @hewg-module taskq/api/tenants
 *
 * HTTP handler functions for tenant management. Provides read access
 * to tenant records and status updates.
 */

import type { Database } from "../storage/connection";
import type { TenantContext, TenantStatus } from "../types/tenant";
import { getTenant, listTenants, updateTenantStatus } from "../storage/tenants";
import type { ApiResponse } from "./jobs";

/**
 * Handle a GET /tenants/me request. Returns the full tenant record
 * for the authenticated tenant context.
 *
 * @hewg-module taskq/api/tenants
 * @effects fs.read, log
 */
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

/**
 * Handle a GET /tenants request. Returns all tenants in the system.
 * This is typically restricted to admin contexts.
 *
 * @hewg-module taskq/api/tenants
 * @effects fs.read, log
 */
export function handleListTenants(db: Database): ApiResponse {
  const tenants = listTenants(db);
  console.log(`[api/tenants] Listed ${tenants.length} tenants`);
  return { status: 200, body: tenants };
}

/**
 * Handle a PATCH /tenants/me/status request. Updates the tenant's
 * lifecycle status (e.g. active, suspended, deactivated). Validates
 * that the new status is a recognized value.
 *
 * @hewg-module taskq/api/tenants
 * @effects fs.read, fs.write, log
 */
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
