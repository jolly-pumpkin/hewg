import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { Project, SyntaxKind } from "ts-morph"
import { runCheck } from "../../src/commands/check.ts"
import type { Diagnostic } from "../../src/diag/types.ts"
import type { Condition } from "./types.ts"

/**
 * @hewg-module bench/lib/metrics
 */

export type MetricResult = {
  hallucinatedSymbols: number | null
  effectViolations: number | null
}

/**
 * @hewg-module bench/lib/metrics
 * @effects fs.read
 */
export function extractMetrics(
  workspace: string,
  condition: Condition,
  beforeTree: Map<string, string>,
): MetricResult {
  const hallucinatedSymbols = countHallucinatedSymbols(workspace, beforeTree)
  const effectViolations = condition === 3 || condition === 4
    ? countEffectViolations(workspace, beforeTree)
    : null
  return { hallucinatedSymbols, effectViolations }
}

function changedTsFiles(workspace: string, before: Map<string, string>): string[] {
  const touched: string[] = []
  const current = listTsFiles(workspace)
  for (const rel of current) {
    const abs = join(workspace, rel)
    const now = safeRead(abs)
    const was = before.get(rel)
    if (now === null) continue
    if (was === undefined || was !== now) touched.push(rel)
  }
  return touched
}

function listTsFiles(root: string): string[] {
  const out: string[] = []
  const stack: string[] = [resolve(root)]
  while (stack.length > 0) {
    const cur = stack.pop()!
    let entries: string[]
    try {
      entries = readdirSync(cur)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry.startsWith(".git")) continue
      const full = join(cur, entry)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) stack.push(full)
      else if (st.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) {
        out.push(relative(root, full))
      }
    }
  }
  out.sort()
  return out
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return null
  }
}

function countHallucinatedSymbols(
  workspace: string,
  before: Map<string, string>,
): number | null {
  const tsconfig = resolve(workspace, "tsconfig.json")
  if (!existsSync(tsconfig)) return null
  const changed = new Set(changedTsFiles(workspace, before))
  if (changed.size === 0) return 0
  let project: Project
  try {
    project = new Project({ tsConfigFilePath: tsconfig })
  } catch {
    return null
  }
  let count = 0
  for (const relPath of changed) {
    const abs = join(workspace, relPath)
    const sf = project.getSourceFile(abs)
    if (sf === undefined) continue

    // Import specifiers that resolve to nothing.
    for (const imp of sf.getImportDeclarations()) {
      const target = imp.getModuleSpecifierSourceFile()
      if (target === undefined) {
        const spec = imp.getModuleSpecifierValue()
        if (!isAmbientLike(spec)) count += 1
      }
    }

    // Unresolvable identifiers in call-expression callees.
    sf.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return
      const expr = node.asKindOrThrow(SyntaxKind.CallExpression).getExpression()
      if (expr.getKind() === SyntaxKind.Identifier) {
        const sym = expr.getSymbol()
        if (sym === undefined) count += 1
      }
    })
  }
  return count
}

function countEffectViolations(
  workspace: string,
  before: Map<string, string>,
): number | null {
  const tsconfig = resolve(workspace, "tsconfig.json")
  if (!existsSync(tsconfig)) return null
  const result = runCheck({ project: tsconfig, format: "json", cwd: workspace })
  if (result.exitCode === 2) return null
  const lines = result.stdout.split("\n").filter((l) => l.trim().length > 0)
  const diags: Diagnostic[] = []
  for (const line of lines) {
    try {
      diags.push(JSON.parse(line) as Diagnostic)
    } catch {
      // skip malformed
    }
  }
  const changed = new Set(changedTsFiles(workspace, before))
  let count = 0
  for (const d of diags) {
    if (!isEffectOrCapViolation(d.code)) continue
    if (changed.has(d.file)) count += 1
  }
  return count
}

function isEffectOrCapViolation(code: string): boolean {
  if (code.startsWith("E030")) return true
  if (code.startsWith("E040")) return true
  return false
}

function isAmbientLike(spec: string): boolean {
  // Relative paths are resolvable by the TS project loader; non-relative
  // specifiers point to node_modules, which we don't bundle. Treat unresolved
  // non-relative as "probably ambient or declared via types" and don't count
  // them as hallucinations — we'd over-count otherwise.
  return !spec.startsWith(".") && !spec.startsWith("/")
}
