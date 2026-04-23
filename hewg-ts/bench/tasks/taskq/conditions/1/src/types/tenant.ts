
import type { BillingPlanId } from "./billing";

export type TenantId = string & { readonly __brand: "TenantId" };

export enum TenantStatus {
  Active = "active",
  Suspended = "suspended",
  Deactivated = "deactivated",
}

export interface Tenant {
  readonly id: TenantId;
  readonly name: string;
  readonly apiKeyHash: string;
  status: TenantStatus;
  readonly plan: BillingPlanId;
  readonly createdAt: Date;
}

export interface TenantContext {
  readonly tenantId: TenantId;
  readonly tenantName: string;
  readonly plan: BillingPlanId;
}

export function toTenantId(raw: string): TenantId {
  return raw as TenantId;
}

export function toTenantContext(tenant: Tenant): TenantContext {
  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    plan: tenant.plan,
  };
}

export function canSubmitJobs(tenant: Tenant): boolean {
  return tenant.status === TenantStatus.Active;
}
