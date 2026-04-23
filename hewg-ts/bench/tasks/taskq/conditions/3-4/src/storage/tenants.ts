/**
 * @hewg-module taskq/storage/tenants
 *
 * CRUD operations for tenants in the simulated JSON-file database.
 */

import type { Tenant, TenantId, TenantStatus } from "../types/tenant";
import type { Database } from "./connection";
import { readDataFile, writeDataFile } from "./connection";

/**
 * Insert a new tenant record into the database.
 *
 * @hewg-module taskq/storage/tenants
 * @effects fs.read, fs.write
 */
export function insertTenant(db: Database, tenant: Tenant): void {
  const data = readDataFile(db);
  data.tenants[tenant.id] = tenant;
  writeDataFile(db, data);
}

/**
 * Retrieve a tenant by their identifier, or null if not found.
 *
 * @hewg-module taskq/storage/tenants
 * @effects fs.read
 */
export function getTenant(db: Database, id: TenantId): Tenant | null {
  const data = readDataFile(db);
  const record = data.tenants[id as string];
  return (record as Tenant) ?? null;
}

/**
 * Look up a tenant by their hashed API key. Returns the first
 * matching tenant or null if no tenant uses that key hash.
 *
 * @hewg-module taskq/storage/tenants
 * @effects fs.read
 */
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

/**
 * Update a tenant's lifecycle status.
 *
 * @hewg-module taskq/storage/tenants
 * @effects fs.read, fs.write
 */
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

/**
 * Return all tenants stored in the database.
 *
 * @hewg-module taskq/storage/tenants
 * @effects fs.read
 */
export function listTenants(db: Database): Tenant[] {
  const data = readDataFile(db);
  return Object.values(data.tenants).map((t) => t as Tenant);
}
