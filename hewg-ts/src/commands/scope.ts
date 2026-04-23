import { dirname } from "node:path"
import { loadEffectMap } from "../analysis/effect-map.ts"
import {
  buildCallGraph,
  findNodeKey,
  formatScopeHuman,
  formatScopeJson,
  queryScope,
} from "../analysis/call-graph.ts"
import { loadHewgConfig, DEFAULT_CHECK, type HewgConfig } from "../config.ts"
import { buildSymbolIndex, lookupSymbol } from "../contract/lookup.ts"
import { DIAGNOSTIC_REGISTRY } from "../diag/codes.ts"
import { renderJson } from "../diag/render.ts"
import type { Diagnostic, Suggestion } from "../diag/types.ts"
import { loadProject } from "../project.ts"

export type ScopeFormat = "human" | "json"

export type RunScopeOptions = {
  project?: string
  format?: ScopeFormat
  depth?: number
  cwd?: string
}

export type RunScopeResult = {
  exitCode: 0 | 1
  stdout: string
  stderr: string
}

/**
 * @hewg-module commands/scope
 * @effects fs.read
 */
export function runScope(symbolArg: string, opts: RunScopeOptions = {}): RunScopeResult {
  const format = opts.format ?? "human"
  const depthLimit = opts.depth ?? 5

  const loaded = loadProject({ cwd: opts.cwd, tsconfigPath: opts.project })
  if (!loaded.ok) {
    return { exitCode: 1, stdout: "", stderr: renderJson([loaded.error]) + "\n" }
  }

  const projectRoot = dirname(loaded.tsconfigPath)
  const index = buildSymbolIndex(loaded.project)

  // Validate symbol exists via standard lookup
  const lookup = lookupSymbol(index, symbolArg)

  if (lookup.kind === "not-found") {
    const info = DIAGNOSTIC_REGISTRY.E0003
    const suggest: Suggestion[] = lookup.nearest.map((n) => ({
      kind: "rename-arg" as const,
      rationale: `did you mean \`${n}\`?`,
      at: { file: "-", line: 1, col: 1, len: symbolArg.length },
      insert: n,
    }))
    const diag: Diagnostic = {
      code: "E0003",
      severity: info.severity,
      file: "-",
      line: 1,
      col: 1,
      len: Math.max(1, symbolArg.length),
      message: `symbol \`${symbolArg}\` not found`,
      docs: info.docsUrl,
    }
    if (suggest.length > 0) diag.suggest = suggest
    return { exitCode: 1, stdout: "", stderr: renderJson([diag]) + "\n" }
  }

  if (lookup.kind === "ambiguous") {
    const info = DIAGNOSTIC_REGISTRY.E0004
    const diag: Diagnostic = {
      code: "E0004",
      severity: info.severity,
      file: "-",
      line: 1,
      col: 1,
      len: Math.max(1, symbolArg.length),
      message: `symbol \`${symbolArg}\` is ambiguous (${lookup.candidates.length} matches)`,
      docs: info.docsUrl,
    }
    return { exitCode: 1, stdout: "", stderr: renderJson([diag]) + "\n" }
  }

  // Build call graph
  let config: HewgConfig
  try {
    config = loadHewgConfig(loaded.tsconfigPath)
  } catch {
    config = { check: DEFAULT_CHECK }
  }

  const effectMap = loadEffectMap((config as { effectMap?: Record<string, { effects: string[] }> }).effectMap)
  const effectPropOpts = {
    effectMap,
    depthLimit: config.check.depthLimit,
    unknownEffectPolicy: config.check.unknownEffectPolicy,
    packages: (config as { packages?: Record<string, { defaultPolicy: "pure" | "warn" }> }).packages,
    defaultPackagePolicy: config.check.defaultPackagePolicy,
  }

  const graph = buildCallGraph(loaded.project, index, effectPropOpts, projectRoot)

  // Find the target in the graph
  const targetKey = findNodeKey(graph, lookup.hit.displayName)
  if (targetKey === undefined) {
    return { exitCode: 1, stdout: "", stderr: `internal error: symbol found in index but not in call graph\n` }
  }

  const result = queryScope(graph, targetKey, depthLimit)
  if (result === undefined) {
    return { exitCode: 1, stdout: "", stderr: `internal error: scope query returned undefined\n` }
  }

  const stdout = format === "json" ? formatScopeJson(result) : formatScopeHuman(result)
  return { exitCode: 0, stdout, stderr: "" }
}
