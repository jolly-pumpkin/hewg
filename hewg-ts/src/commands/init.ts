import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { loadEffectMap } from "../analysis/effect-map.ts"
import { buildSymbolIndex } from "../contract/lookup.ts"
import { DEFAULT_CHECK, loadHewgConfig } from "../config.ts"
import { DIAGNOSTIC_REGISTRY } from "../diag/codes.ts"
import { renderJson } from "../diag/render.ts"
import type { Diagnostic } from "../diag/types.ts"
import { generateClaudeMd, spliceIntoExisting, wrapWithMarkers } from "../generators/claude-md.ts"
import { loadProject } from "../project.ts"

export type RunInitOptions = {
  path?: string
  cwd?: string
  claudeMd?: boolean
}

export type RunInitResult = {
  exitCode: 0 | 1 | 2
  stdout: string
  stderr: string
}

/**
 * @hewg-module commands/init
 * @effects fs.read, fs.write
 */
export function runInit(opts: RunInitOptions = {}): RunInitResult {
  if (opts.claudeMd) return runInitClaudeMd(opts)
  return runInitConfig(opts)
}

function runInitConfig(opts: RunInitOptions): RunInitResult {
  const cwd = opts.cwd ?? process.cwd()
  const target = opts.path === undefined
    ? cwd
    : isAbsolute(opts.path)
      ? opts.path
      : resolve(cwd, opts.path)

  const loaded = loadProject({ cwd: target })
  if (!loaded.ok) {
    return { exitCode: 1, stdout: "", stderr: renderJson([loaded.error]) }
  }

  const cfgDir = dirname(loaded.tsconfigPath)
  const cfgPath = resolve(cfgDir, "hewg.config.json")
  const relCfg = relative(cwd, cfgPath)
  const displayPath = relCfg.length > 0 ? relCfg : cfgPath

  if (existsSync(cfgPath)) {
    const info = DIAGNOSTIC_REGISTRY.E0005
    const diag: Diagnostic = {
      code: "E0005",
      severity: info.severity,
      file: displayPath,
      line: 1,
      col: 1,
      len: 1,
      message: "hewg.config.json already exists; refusing to overwrite",
      docs: info.docsUrl,
    }
    return { exitCode: 1, stdout: "", stderr: renderJson([diag]) }
  }

  const content = JSON.stringify({ check: DEFAULT_CHECK }, null, 2) + "\n"
  writeFileSync(cfgPath, content, "utf8")

  return { exitCode: 0, stdout: `wrote ${displayPath}\n`, stderr: "" }
}

function runInitClaudeMd(opts: RunInitOptions): RunInitResult {
  const cwd = opts.cwd ?? process.cwd()
  const target = opts.path === undefined
    ? cwd
    : isAbsolute(opts.path)
      ? opts.path
      : resolve(cwd, opts.path)

  const loaded = loadProject({ cwd: target })
  if (!loaded.ok) {
    return { exitCode: 1, stdout: "", stderr: renderJson([loaded.error]) }
  }

  const projectRoot = dirname(loaded.tsconfigPath)
  const index = buildSymbolIndex(loaded.project)

  // Load config — if no hewg.config.json, use defaults
  let config
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

  const generated = generateClaudeMd({
    index,
    project: loaded.project,
    effectPropOpts,
    projectRoot,
  })

  const claudeMdPath = resolve(projectRoot, "CLAUDE.md")
  const relPath = relative(cwd, claudeMdPath)
  const displayPath = relPath.length > 0 ? relPath : claudeMdPath

  let content: string
  if (existsSync(claudeMdPath)) {
    const existing = readFileSync(claudeMdPath, "utf8")
    content = spliceIntoExisting(existing, generated)
  } else {
    content = wrapWithMarkers(generated)
  }

  writeFileSync(claudeMdPath, content, "utf8")

  return { exitCode: 0, stdout: `wrote ${displayPath}\n`, stderr: "" }
}
