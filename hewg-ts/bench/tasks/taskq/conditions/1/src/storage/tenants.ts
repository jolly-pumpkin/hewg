
import type { Tenant, TenantId, TenantStatus } from "../types/tenant";
import type { Database } from "./connection";
import { readDataFile, writeDataFile } from "./connection";

export function insertTenant(db: Database, tenant: Tenant): void {
  const data = readDataFile(db);
  data.tenants[tenant.id] = tenant;
  writeDataFile(db, data);
}

export function getTenant(db: Database, id: TenantId): Tenant | null {
  const data = readDataFile(db);
  const record = data.tenants[id as string];
  return (record as Tenant) ?? null;
}

export function getTenantByApiKey(
  db: Database,
  apiKeyHash: string,
): Tenant | null {
  const data = readDataFile(db);
  const match = Object.values(data.tenants).find(
    (t) => (t as Tenant).apiKeyHash === apiKeyHash,
  );
  return (match as Tenant) ?? null;
}

export function updateTenantStatus(
  db: Database,
  id: TenantId,
  status: TenantStatus,
): void {
  const data = readDataFile(db);
  const tenant = data.tenants[id as string] as Tenant | undefined;
  if (!tenant) return;

  tenant.status = status;
  writeDataFile(db, data);
}

export function listTenants(db: Database): Tenant[] {
  const data = readDataFile(db);
  return Object.values(data.tenants).map((t) => t as Tenant);
}
