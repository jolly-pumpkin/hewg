/**
 *
 * Tenant identity and context types for multi-tenant isolation.
 */

import type { BillingPlanId } from "./billing";

/**
 * Lightweight context threaded through the request path so that
 * downstream services know which tenant is making the call without
 * carrying the full Tenant record.
 */
export interface TenantContext {
  readonly tenantId: TenantId;
  readonly tenantName: string;
  readonly plan: BillingPlanId;
}

/**
 * Create a branded TenantId from a raw string.
 */
export function toTenantId(raw: string): TenantId {
  return raw as TenantId;
}

/**
 * Build a TenantContext from a full Tenant record.
 */
export function toTenantContext(tenant: Tenant): TenantContext {
  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    plan: tenant.plan,
  };
}

/**
 * Return true if the tenant is allowed to submit jobs.
 * Suspended and deactivated tenants are blocked.
 */
export function canSubmitJobs(tenant: Tenant): boolean {
  return tenant.status === TenantStatus.Active;
}
