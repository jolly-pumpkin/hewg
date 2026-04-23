/**
 * @hewg-module taskq/auth/tenant-isolation
 *
 * Multi-tenant isolation guards. These pure functions enforce that
 * a request context can only access resources owned by the same
 * tenant, preventing cross-tenant data leakage.
 */

import type { Tenant, TenantContext, TenantId } from "../types/tenant";

/**
 * Assert that the authenticated tenant context is allowed to access
 * a resource belonging to the given tenant. Throws if the tenant
 * identifiers do not match.
 *
 * @hewg-module taskq/auth/tenant-isolation
 * @effects
 */
export function assertTenantAccess(
  ctx: TenantContext,
  resourceTenantId: TenantId,
): void {
  if ((ctx.tenantId as string) !== (resourceTenantId as string)) {
    throw new Error(
      `Tenant isolation violation: context tenant ${ctx.tenantId} ` +
        `cannot access resource owned by ${resourceTenantId}`,
    );
  }
}

/**
 * Check whether the authenticated tenant context is allowed to
 * access a resource belonging to the given tenant. Returns true
 * when access is permitted, false otherwise.
 *
 * @hewg-module taskq/auth/tenant-isolation
 * @effects
 */
export function canAccessResource(
  ctx: TenantContext,
  resourceTenantId: TenantId,
): boolean {
  return (ctx.tenantId as string) === (resourceTenantId as string);
}

/**
 * Build a lightweight TenantContext from a full Tenant record. The
 * context carries only the fields needed for authorization checks
 * downstream.
 *
 * @hewg-module taskq/auth/tenant-isolation
 * @effects
 */
export function buildTenantContext(tenant: Tenant): TenantContext {
  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    plan: tenant.plan,
  };
}
