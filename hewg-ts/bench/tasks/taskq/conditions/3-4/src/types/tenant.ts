/**
 * @hewg-module taskq/types/tenant
 *
 * Tenant identity and context types for multi-tenant isolation.
 */

import type { BillingPlanId } from "./billing";

/** Branded string type for tenant identifiers. */
export type TenantId = string & { readonly __brand: "TenantId" };

/** Lifecycle status of a tenant account. */
export enum TenantStatus {
  Active = "active",
  Suspended = "suspended",
  Deactivated = "deactivated",
}

/** A registered tenant in the system. */
export interface Tenant {
  readonly id: TenantId;
  readonly name: string;
  readonly apiKeyHash: string;
  status: TenantStatus;
  readonly plan: BillingPlanId;
  readonly createdAt: Date;
}

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
 * @hewg-module taskq/types/tenant
 * @effects
 */
export function toTenantId(raw: string): TenantId {
  return raw as TenantId;
}

/**
 * Build a TenantContext from a full Tenant record.
 * @hewg-module taskq/types/tenant
 * @effects
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
 * @hewg-module taskq/types/tenant
 * @effects
 */
export function canSubmitJobs(tenant: Tenant): boolean {
  return tenant.status === TenantStatus.Active;
}
