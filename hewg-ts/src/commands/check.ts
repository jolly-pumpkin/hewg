import { dirname, relative } from "node:path"
import { readFileSync } from "node:fs"
import { runCapFlow } from "../analysis/cap-flow.ts"
import { loadEffectMap } from "../analysis/effect-map.ts"
import { runEffectPropagation } from "../analysis/effect-prop.ts"
import { loadHewgConfig } from "../config.ts"
import { buildSymbolIndex } from "../contract/lookup.ts"
import { DIAGNOSTIC_REGISTRY } from "../diag/codes.ts"
import { renderHuman, renderJson, renderSarif } from "../diag/render.ts"
import type { Diagnostic } from "../diag/types.ts"
import { loadProject } from "../project.ts"

export type CheckFormat = "human" | "json" | "sarif"

export type RunCheckOptions = {
  project?: string
  format?: CheckFormat
  cwd?: string
}

export type RunCheckResult = {
  exitCode: 0 | 1 | 2
  stdout: string
  stderr: string
}

/**
 * @hewg-module commands/check
 * @effects fs.read
 */
export function runCheck(opts: RunCheckOptions = {}): RunCheckResult {
  const format = opts.format ?? "human"
  const loaded = loadProject({ cwd: opts.cwd, tsconfigPath: opts.project })
  if (!loaded.ok) {
    return { exitCode: 1, stdout: "", stderr: render([loaded.error], format, undefined) + "\n" }
  }

  const projectRoot = dirname(loaded.tsconfigPath)

  let config
  try {
    config = loadHewgConfig(loaded.tsconfigPath)
  } catch (e) {
    const info = DIAGNOSTIC_REGISTRY.E0002
    const diag: Diagnostic = {
      code: "E0002",
      severity: info.severity,
      file: "hewg.config.json",
      line: 1,
      col: 1,
      len: 1,
      message: `could not parse hewg.config.json: ${(e as Error).message}`,
      docs: info.docsUrl,
    }
    return { exitCode: 2, stdout: "", stderr: render([diag], format, undefined) + "\n" }
  }

  const effectMap = loadEffectMap(config.effectMap)
  const index = buildSymbolIndex(loaded.project)
  const effectDiags = runEffectPropagation(loaded.project, index, {
    effectMap,
    depthLimit: config.check.depthLimit,
    unknownEffectPolicy: config.check.unknownEffectPolicy,
  })
  const capDiags = runCapFlow(index)
  const diags = [...effectDiags, ...capDiags]

  const relative_ = (abs: string): string => {
    if (abs === "-") return abs
    const r = relative(projectRoot, abs)
    return r.length === 0 ? abs : r
  }
  // Load source snippets from absolute paths BEFORE rewriting, keyed by the
  // relative paths the renderer will see.
  const sources =
    format === "human" ? loadSources(diags, relative_) : undefined
  const normalized = diags.map((d) => rewriteFile(d, relative_))
  const out = render(normalized, format, sources)

  const hasError = normalized.some((d) => d.severity === "error")
  return {
    exitCode: hasError ? 1 : 0,
    stdout: out.length > 0 ? out : "",
    stderr: "",
  }
}

function rewriteFile(d: Diagnostic, rel: (p: string) => string): Diagnostic {
  const out: Diagnostic = { ...d, file: rel(d.file) }
  if (d.related !== undefined) {
    out.related = d.related.map((r) => ({ ...r, file: rel(r.file) }))
  }
  if (d.suggest !== undefined) {
    out.suggest = d.suggest.map((s) => ({ ...s, at: { ...s.at, file: rel(s.at.file) } }))
  }
  return out
}

function loadSources(
  diags: readonly Diagnostic[],
  relativeOf: (abs: string) => string,
): Map<string, string> {
  const map = new Map<string, string>()
  const paths = new Set<string>()
  for (const d of diags) paths.add(d.file)
  for (const p of paths) {
    if (p === "-") continue
    try {
      map.set(relativeOf(p), readFileSync(p, "utf8"))
    } catch {
      // ignore; renderer falls back
    }
  }
  return map
}

function render(
  diags: readonly Diagnostic[],
  format: CheckFormat,
  sources: Map<string, string> | undefined,
): string {
  if (format === "json") return renderJson(diags)
  if (format === "sarif") return renderSarif(diags)
  return renderHuman(diags, sources !== undefined ? { sources } : {})
}
