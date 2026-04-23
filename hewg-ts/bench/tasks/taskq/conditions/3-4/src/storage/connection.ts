/**
 * @hewg-module taskq/storage/connection
 *
 * Simulated database connection backed by a JSON file on disk.
 */

import * as fs from "node:fs";

/** Handle representing an open database connection. */
export interface Database {
  readonly path: string;
  connected: boolean;
}

interface DataFile {
  jobs: Record<string, unknown>;
  tenants: Record<string, unknown>;
  usage: Record<string, unknown>;
}

const EMPTY_DATA: DataFile = {
  jobs: {},
  tenants: {},
  usage: {},
};

/**
 * Open a database connection at the given file path. If the backing
 * JSON file does not exist it is created with an empty schema.
 *
 * @hewg-module taskq/storage/connection
 * @effects fs.read, fs.write
 */
export function openDatabase(path: string): Database {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify(EMPTY_DATA, null, 2), "utf-8");
  }

  return { path, connected: true };
}

/**
 * Close the database connection. After calling this the handle
 * should not be used for further reads or writes.
 *
 * @hewg-module taskq/storage/connection
 * @effects
 */
export function closeDatabase(db: Database): void {
  db.connected = false;
}

/**
 * Read and parse the raw data file backing the database.
 *
 * @hewg-module taskq/storage/connection
 * @effects fs.read
 */
export function readDataFile(db: Database): DataFile {
  const raw = fs.readFileSync(db.path, "utf-8");
  return JSON.parse(raw) as DataFile;
}

/**
 * Write the full data structure back to the backing JSON file.
 *
 * @hewg-module taskq/storage/connection
 * @effects fs.write
 */
export function writeDataFile(db: Database, data: DataFile): void {
  fs.writeFileSync(db.path, JSON.stringify(data, null, 2), "utf-8");
}
