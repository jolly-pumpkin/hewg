import { existsSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"
import { Project } from "ts-morph"
import { DIAGNOSTIC_REGISTRY } from "./diag/codes.ts"
import type { Diagnostic } from "./diag/types.ts"

export type LoadedProject = {
  project: Project
  tsconfigPath: string
}

export type LoadProjectResult =
  | { ok: true; project: Project; tsconfigPath: string }
  | { ok: false; error: Diagnostic }

export type LoadProjectOptions = {
  cwd?: string
  tsconfigPath?: string
}

export function loadProject(opts: LoadProjectOptions = {}): LoadProjectResult {
  const cwd = opts.cwd ?? process.cwd()
  const explicit = opts.tsconfigPath
  const found = explicit
    ? (isAbsolute(explicit) ? explicit : resolve(cwd, explicit))
    : findTsconfig(cwd)
  if (found === undefined || !existsSync(found)) {
    const info = DIAGNOSTIC_REGISTRY.E0001
    const error: Diagnostic = {
      code: "E0001",
      severity: info.severity,
      file: "-",
      line: 1,
      col: 1,
      len: 1,
      message: "no tsconfig.json found at or above the current directory",
      notes: [
        { message: "run hewg from a directory containing a tsconfig.json, or pass --project <path>" },
      ],
      docs: info.docsUrl,
    }
    return { ok: false, error }
  }
  const project = new Project({ tsConfigFilePath: found })
  return { ok: true, project, tsconfigPath: found }
}

function findTsconfig(start: string): string | undefined {
  let dir = resolve(start)
  while (true) {
    const candidate = resolve(dir, "tsconfig.json")
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}
