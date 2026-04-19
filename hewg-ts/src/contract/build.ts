import { relative } from "node:path"
import type {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  MethodDeclaration,
  ParameterDeclaration,
} from "ts-morph"
import { parseAnnotations } from "../annotations/parser.ts"
import type { CostField, ParsedAnnotation } from "../annotations/types.ts"
import type { ExportHit } from "./lookup.ts"
import type {
  ContractCapJson,
  ContractCostJson,
  ContractJson,
} from "./types.ts"

export type BuildContractOptions = {
  projectRoot: string
}

/**
 * @hewg-module contract/build
 * @effects
 */
export function buildContract(hit: ExportHit, opts: BuildContractOptions): ContractJson {
  const parsed = parseAnnotations(hit.decl)
  const annotations = parsed.annotations

  const symbol = makeSymbol(hit)
  const signature = renderSignature(hit.fn)
  const { line } = hit.decl.getSourceFile().getLineAndColumnAtPos(hit.decl.getStart())
  const filePath = relative(opts.projectRoot, hit.decl.getSourceFile().getFilePath())

  const annotated = annotations.length > 0

  return {
    symbol,
    signature,
    effects: annotated ? collectEffects(annotations) : null,
    caps: annotated ? collectCaps(annotations) : null,
    pre: annotated ? collectExprs(annotations, "pre") : null,
    post: annotated ? collectExprs(annotations, "post") : null,
    cost: annotated ? collectCost(annotations) : null,
    errors: null,
    source: { file: filePath, line },
  }
}

function makeSymbol(hit: ExportHit): string {
  if (hit.moduleName !== undefined) return `${hit.moduleName}::${hit.displayName}`
  return hit.displayName
}

type FnLike = FunctionDeclaration | ArrowFunction | FunctionExpression | MethodDeclaration

function renderSignature(fn: FnLike): string {
  const params = fn.getParameters().map(renderParam).join(", ")
  const ret = renderReturn(fn)
  return `(${params}) => ${ret}`
}

function renderParam(p: ParameterDeclaration): string {
  const name = p.getName()
  const tnode = p.getTypeNode()
  const type = tnode !== undefined ? tnode.getText() : p.getType().getText(p)
  const question = p.hasQuestionToken() ? "?" : ""
  const rest = p.isRestParameter() ? "..." : ""
  return `${rest}${name}${question}: ${type}`
}

function renderReturn(fn: FnLike): string {
  const tnode = fn.getReturnTypeNode()
  if (tnode !== undefined) return tnode.getText()
  return fn.getReturnType().getText(fn)
}

function collectEffects(ann: readonly ParsedAnnotation[]): readonly string[] {
  const out: string[] = []
  for (const a of ann) if (a.kind === "effects") out.push(...a.effects)
  return out
}

function collectCaps(ann: readonly ParsedAnnotation[]): Record<string, ContractCapJson> {
  const out: Record<string, ContractCapJson> = {}
  for (const a of ann) {
    if (a.kind !== "cap") continue
    const entry: Record<string, unknown> = { kind: a.effect }
    const s = a.scope
    if (s.kind === "net") {
      if (s.host !== undefined) entry.host = s.host
      if (s.port !== undefined) entry.port = s.port
      if (s.pathPrefix !== undefined) entry.path_prefix = s.pathPrefix
    } else if (s.kind === "fs") {
      if (s.prefix !== undefined) entry.prefix = s.prefix
    } else if (s.kind === "proc") {
      if (s.cmdAllowlist !== undefined) entry.cmd_allowlist = s.cmdAllowlist
    }
    out[a.param] = entry as ContractCapJson
  }
  return out
}

function collectExprs(ann: readonly ParsedAnnotation[], kind: "pre" | "post"): readonly string[] {
  const out: string[] = []
  for (const a of ann) if (a.kind === kind) out.push(a.expression)
  return out
}

function collectCost(ann: readonly ParsedAnnotation[]): ContractCostJson | null {
  for (const a of ann) {
    if (a.kind !== "cost") continue
    const out: ContractCostJson = {}
    for (const f of a.fields) out[f.key] = renderCostField(f)
    return out
  }
  return null
}

function renderCostField(f: CostField): number | string {
  if (!f.known) {
    const idx = f.raw.search(/<=|=/)
    return idx === -1 ? f.raw : f.raw.slice(idx)
  }
  switch (f.key) {
    case "tokens":
      return f.value
    case "ops":
      return f.approx ? `~${f.value}` : f.value
    case "net":
    case "fs":
    case "proc":
      return `<=${f.value}`
    case "time":
      return `<=${formatDuration(f.durationMs)}`
  }
}

function formatDuration(ms: number): string {
  if (ms % 3_600_000 === 0 && ms >= 3_600_000) return `${ms / 3_600_000}h`
  if (ms % 60_000 === 0 && ms >= 60_000) return `${ms / 60_000}m`
  if (ms % 1000 === 0 && ms >= 1000) return `${ms / 1000}s`
  return `${ms}ms`
}
