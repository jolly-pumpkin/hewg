
import type { Tenant, TenantContext, TenantId } from "../types/tenant";

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

export function canAccessResource(
  ctx: TenantContext,
  resourceTenantId: TenantId,
): boolean {
  return (ctx.tenantId as string) === (resourceTenantId as string);
}

export function buildTenantContext(tenant: Tenant): TenantContext {
  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    plan: tenant.plan,
  };
}
