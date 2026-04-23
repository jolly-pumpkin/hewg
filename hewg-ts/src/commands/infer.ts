import { dirname, relative } from "node:path"
import { loadEffectMap } from "../analysis/effect-map.ts"
import { runInfer, formatInferDiff, formatInferJson, applyInferInsertions } from "../analysis/infer.ts"
import { loadHewgConfig, DEFAULT_CHECK, type HewgConfig } from "../config.ts"
import { buildSymbolIndex } from "../contract/lookup.ts"
import { renderJson } from "../diag/render.ts"
import { loadProject } from "../project.ts"

export type InferFormat = "diff" | "json" | "apply"

export type RunInferOptions = {
  project?: string
  format?: InferFormat
  cwd?: string
}

export type RunInferResult = {
  exitCode: 0 | 1
  stdout: string
  stderr: string
}

/**
 * @hewg-module commands/infer
 * @effects fs.read, fs.write
 */
export function runInferCommand(opts: RunInferOptions = {}): RunInferResult {
  const format = opts.format ?? "diff"

  const loaded = loadProject({ cwd: opts.cwd, tsconfigPath: opts.project })
  if (!loaded.ok) {
    return { exitCode: 1, stdout: "", stderr: renderJson([loaded.error]) + "\n" }
  }

  const projectRoot = dirname(loaded.tsconfigPath)
  const index = buildSymbolIndex(loaded.project)

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

  const result = runInfer(loaded.project, index, effectPropOpts, projectRoot)

  if (format === "json") {
    return { exitCode: 0, stdout: formatInferJson(result), stderr: "" }
  }

  if (format === "apply") {
    const applied = applyInferInsertions(result, index, loaded.project)
    // Save modified files
    loaded.project.saveSync()
    const msg = `Applied @effects to ${applied} function${applied === 1 ? "" : "s"}\n`
    return { exitCode: 0, stdout: msg, stderr: "" }
  }

  // Default: diff
  const diff = formatInferDiff(result)
  if (diff.length === 0) {
    return { exitCode: 0, stdout: "", stderr: "All exported functions already have @effects annotations.\n" }
  }
  return { exitCode: 0, stdout: diff, stderr: "" }
}
