
import { Database } from "bun:sqlite"
import { runMigrations } from "./migrations.ts"

export function openDb(path: string): Database {
  const db = new Database(path, { create: true })
  db.exec("PRAGMA journal_mode = WAL")
  runMigrations(db)
  return db
}

export function openMemoryDb(): Database {
  const db = new Database(":memory:")
  runMigrations(db)
  return db
}
