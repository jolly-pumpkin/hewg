/**
 * @hewg-module weather/db/connection
 */

import { Database } from "bun:sqlite"
import { runMigrations } from "./migrations.ts"

/**
 * Open (or create) a SQLite database at the given path and run migrations.
 * @effects fs.read, fs.write
 */
export function openDb(path: string): Database {
  const db = new Database(path, { create: true })
  db.exec("PRAGMA journal_mode = WAL")
  runMigrations(db)
  return db
}

/**
 * Open an in-memory database for testing.
 * @effects
 */
export function openMemoryDb(): Database {
  const db = new Database(":memory:")
  runMigrations(db)
  return db
}
