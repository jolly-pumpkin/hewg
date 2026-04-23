
import * as fs from "node:fs";

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

export function openDatabase(path: string): Database {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify(EMPTY_DATA, null, 2), "utf-8");
  }

  return { path, connected: true };
}

export function closeDatabase(db: Database): void {
  db.connected = false;
}

export function readDataFile(db: Database): DataFile {
  const raw = fs.readFileSync(db.path, "utf-8");
  return JSON.parse(raw) as DataFile;
}

export function writeDataFile(db: Database, data: DataFile): void {
  fs.writeFileSync(db.path, JSON.stringify(data, null, 2), "utf-8");
}
