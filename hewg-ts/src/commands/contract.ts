import { dirname } from "node:path"
import { DIAGNOSTIC_REGISTRY } from "../diag/codes.ts"
import { renderHuman, renderJson } from "../diag/render.ts"
import type { Diagnostic, RelatedInfo, Suggestion } from "../diag/types.ts"
import { buildContract } from "../contract/build.ts"
import { buildSymbolIndex, lookupSymbol, type ExportHit } from "../contract/lookup.ts"
import type { ContractJson } from "../contract/types.ts"
import { loadProject } from "../project.ts"

export type ContractFormat = "json" | "human"

export type RunContractOptions = {
  project?: string
  format?: ContractFormat
  cwd?: string
}

export type RunContractResult = {
  exitCode: 0 | 1 | 2
  stdout: string
  stderr: string
}

/**
 * @hewg-module commands/contract
 * @effects fs.read
 */
export function runContract(symbolArg: string, opts: RunContractOptions = {}): RunContractResult {
  const loaded = loadProject({ cwd: opts.cwd, tsconfigPath: opts.project })
  if (!loaded.ok) {
    return { exitCode: 1, stdout: "", stderr: renderDiagStderr(loaded.error, opts.format) }
  }

  const projectRoot = dirname(loaded.tsconfigPath)
  const index = buildSymbolIndex(loaded.project)
  const result = lookupSymbol(index, symbolArg)

  if (result.kind === "not-found") {
    const diag = makeNotFoundDiag(symbolArg, result.nearest)
    return { exitCode: 1, stdout: "", stderr: renderDiagStderr(diag, opts.format) }
  }

  if (result.kind === "ambiguous") {
    const diag = makeAmbiguousDiag(symbolArg, result.candidates, projectRoot)
    return { exitCode: 1, stdout: "", stderr: renderDiagStderr(diag, opts.format) }
  }

  const contract = buildContract(result.hit, { projectRoot })
  const stdout = renderContract(contract, opts.format ?? "json")
  const info = isUnannotated(contract)
    ? renderDiagStderr(makeUnannotatedDiag(contract, result.hit), opts.format)
    : ""
  return { exitCode: 0, stdout, stderr: info }
}

function renderContract(contract: ContractJson, fmt: ContractFormat): string {
  if (fmt === "human") return JSON.stringify(contract, null, 2)
  return JSON.stringify(contract)
}

function isUnannotated(contract: ContractJson): boolean {
  return (
    contract.effects === null &&
    contract.caps === null &&
    contract.pre === null &&
    contract.post === null &&
    contract.cost === null
  )
}

function renderDiagStderr(diag: Diagnostic, fmt: ContractFormat | undefined): string {
  if (fmt === "human") return renderHuman([diag])
  return renderJson([diag])
}

function makeNotFoundDiag(query: string, nearest: readonly string[]): Diagnostic {
  const info = DIAGNOSTIC_REGISTRY.E0003
  const suggest: Suggestion[] = nearest.map((n) => ({
    kind: "rename-arg",
    rationale: `did you mean \`${n}\`?`,
    at: { file: "-", line: 1, col: 1, len: query.length },
    insert: n,
  }))
  const d: Diagnostic = {
    code: "E0003",
    severity: info.severity,
    file: "-",
    line: 1,
    col: 1,
    len: Math.max(1, query.length),
    message: `symbol \`${query}\` not found`,
    docs: info.docsUrl,
  }
  if (suggest.length > 0) d.suggest = suggest
  return d
}

function makeAmbiguousDiag(
  query: string,
  candidates: readonly ExportHit[],
  projectRoot: string,
): Diagnostic {
  const info = DIAGNOSTIC_REGISTRY.E0004
  const related: RelatedInfo[] = candidates.map((hit) => {
    const sf = hit.decl.getSourceFile()
    const { line, column } = sf.getLineAndColumnAtPos(hit.decl.getStart())
    const label = hit.moduleName !== undefined
      ? `candidate: ${hit.moduleName}::${hit.displayName}`
      : `candidate: ${hit.displayName}`
    return {
      file: relativePath(sf.getFilePath(), projectRoot),
      line,
      col: column,
      len: hit.displayName.length,
      message: label,
    }
  })
  return {
    code: "E0004",
    severity: info.severity,
    file: "-",
    line: 1,
    col: 1,
    len: Math.max(1, query.length),
    message: `symbol \`${query}\` is ambiguous (${candidates.length} matches)`,
    related,
    docs: info.docsUrl,
  }
}

function makeUnannotatedDiag(contract: ContractJson, hit: ExportHit): Diagnostic {
  const info = DIAGNOSTIC_REGISTRY.I0001
  const sf = hit.decl.getSourceFile()
  const { line, column } = sf.getLineAndColumnAtPos(hit.decl.getStart())
  return {
    code: "I0001",
    severity: info.severity,
    file: contract.source.file,
    line,
    col: column,
    len: hit.displayName.length,
    message: `symbol \`${contract.symbol}\` has no Hewg annotations; returning signature only`,
    notes: [
      { message: "run `hewg check` to see whether this function should declare @effects; null in the contract means 'unknown', not 'pure'" },
    ],
    docs: info.docsUrl,
  }
}

function relativePath(abs: string, root: string): string {
  if (abs.startsWith(root + "/")) return abs.slice(root.length + 1)
  return abs
}
