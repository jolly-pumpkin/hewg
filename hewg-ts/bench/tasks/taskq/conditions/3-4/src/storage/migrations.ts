/**
 * @hewg-module taskq/storage/migrations
 *
 * Schema migration helpers that ensure the backing JSON data file
 * has the expected top-level structure before the application starts.
 */

import type { Database } from "./connection";
import { readDataFile, writeDataFile } from "./connection";

interface DataFile {
  jobs: Record<string, unknown>;
  tenants: Record<string, unknown>;
  usage: Record<string, unknown>;
  _meta?: { version: number; migratedAt: string };
}

const CURRENT_VERSION = 1;

/**
 * Run all pending migrations on the database. Currently this ensures
 * the data file contains every required top-level collection and
 * stamps a version marker.
 *
 * @hewg-module taskq/storage/migrations
 * @effects fs.read, fs.write, log
 */
export function runMigrations(db: Database): void {
  console.log("[migrations] checking schema version...");

  const data = readDataFile(db) as DataFile;
  const version = data._meta?.version ?? 0;

  if (version < CURRENT_VERSION) {
    console.log(
      `[migrations] upgrading from v${version} to v${CURRENT_VERSION}`,
    );
    createInitialSchema(db);
  } else {
    console.log("[migrations] schema is up to date");
  }
}

/**
 * Write the initial schema to the data file, back-filling any
 * missing collections without destroying existing data.
 *
 * @hewg-module taskq/storage/migrations
 * @effects fs.read, fs.write, log
 */
export function createInitialSchema(db: Database): void {
  const data = readDataFile(db) as DataFile;

  if (!data.jobs) {
    console.log("[migrations] creating jobs collection");
    data.jobs = {};
  }
  if (!data.tenants) {
    console.log("[migrations] creating tenants collection");
    data.tenants = {};
  }
  if (!data.usage) {
    console.log("[migrations] creating usage collection");
    data.usage = {};
  }

  data._meta = {
    version: CURRENT_VERSION,
    migratedAt: new Date().toISOString(),
  };

  writeDataFile(db, data);
  console.log("[migrations] schema migration complete");
}
