import { existsSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { DEFAULT_CHECK } from "../config.ts"
import { DIAGNOSTIC_REGISTRY } from "../diag/codes.ts"
import { renderJson } from "../diag/render.ts"
import type { Diagnostic } from "../diag/types.ts"
import { loadProject } from "../project.ts"

export type RunInitOptions = {
  path?: string
  cwd?: string
}

export type RunInitResult = {
  exitCode: 0 | 1 | 2
  stdout: string
  stderr: string
}

export function runInit(opts: RunInitOptions = {}): RunInitResult {
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
