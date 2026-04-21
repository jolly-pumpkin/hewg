import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { Diagnostic } from "./diag/types.ts"

export const BASELINE_FILENAME = ".hewg-baseline.json"

export type BaselineSchema = {
  version: 1
  hewgVersion: string
  generatedAt: string
  count: number
  entries: Record<string, number>
}

/**
 * @hewg-module baseline
 * @effects
 */
export function fingerprint(d: Diagnostic): string {
  return `${d.code}::${d.file}::${d.message}`
}

/**
 * @effects
 */
export function buildBaseline(
  diags: readonly Diagnostic[],
  hewgVersion: string,
): BaselineSchema {
  const entries: Record<string, number> = {}
  for (const d of diags) {
    const key = fingerprint(d)
    entries[key] = (entries[key] ?? 0) + 1
  }
  const sorted: Record<string, number> = {}
  for (const key of Object.keys(entries).sort()) {
    sorted[key] = entries[key]
  }
  return {
    version: 1,
    hewgVersion,
    generatedAt: new Date().toISOString(),
    count: diags.length,
    entries: sorted,
  }
}

/**
 * @effects fs.read
 */
export function loadBaseline(projectRoot: string): BaselineSchema | null {
  const filePath = join(projectRoot, BASELINE_FILENAME)
  if (!existsSync(filePath)) return null
  const raw = readFileSync(filePath, "utf8")
  const parsed = JSON.parse(raw) as BaselineSchema
  if (parsed.version !== 1) {
    throw new Error(
      `${BASELINE_FILENAME}: unsupported version ${String(parsed.version)}`,
    )
  }
  if (typeof parsed.entries !== "object" || parsed.entries === null) {
    throw new Error(`${BASELINE_FILENAME}: missing or invalid entries`)
  }
  return parsed
}

/**
 * @effects fs.write
 */
export function writeBaseline(
  projectRoot: string,
  schema: BaselineSchema,
): void {
  const filePath = join(projectRoot, BASELINE_FILENAME)
  const content = JSON.stringify(schema, null, 2) + "\n"
  // Atomic write: temp file then rename
  const tmpPath = join(tmpdir(), `.hewg-baseline-${Date.now()}.json`)
  writeFileSync(tmpPath, content, "utf8")
  renameSync(tmpPath, filePath)
}

export type FilterResult = {
  remaining: Diagnostic[]
  fixed: number
}

/**
 * @effects
 */
export function filterBaselined(
  diags: readonly Diagnostic[],
  baseline: BaselineSchema,
): FilterResult {
  // Clone counts so we can decrement
  const counts = new Map<string, number>()
  for (const [key, count] of Object.entries(baseline.entries)) {
    counts.set(key, count)
  }

  // Sort diagnostics deterministically for reproducible results
  const sorted = [...diags].sort((a, b) => {
    const fc = a.file.localeCompare(b.file)
    if (fc !== 0) return fc
    return a.line - b.line
  })

  const remaining: Diagnostic[] = []
  for (const d of sorted) {
    const key = fingerprint(d)
    const current = counts.get(key) ?? 0
    if (current > 0) {
      counts.set(key, current - 1)
    } else {
      remaining.push(d)
    }
  }

  // Fixed = sum of remaining counts (entries that existed in baseline but no longer appear)
  let fixed = 0
  for (const count of counts.values()) {
    fixed += count
  }

  return { remaining, fixed }
}
