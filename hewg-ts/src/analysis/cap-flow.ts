// Capability flow pass — v0 is parameter-name-based (see Design.md §4.3).
//
// For each call to a project-local annotated function, we check that every
// `@cap` the callee declares is satisfied by a caller `@cap` threaded at that
// parameter position. Diagnostics:
//   - E0402: caller does not declare a capability for that slot
//   - E0403: caller's capability parameter name differs from the callee's
//   - E0401: names align but effect/kind/scope is not at-least-as-permissive

import type {
  CallExpression,
  FunctionDeclaration,
  Identifier,
  JSDocableNode,
  MethodDeclaration,
  Node,
  ParameterDeclaration,
  VariableDeclaration,
} from "ts-morph"
import { SyntaxKind } from "ts-morph"
import { parseAnnotations } from "../annotations/parser.ts"
import type { CapScope, ParsedAnnotation } from "../annotations/types.ts"
import type {
  ExportHit,
  ExportedFunctionLike,
  SymbolIndex,
} from "../contract/lookup.ts"
import { DIAGNOSTIC_REGISTRY } from "../diag/codes.ts"
import type {
  Diagnostic,
  RelatedInfo,
  Span,
  Suggestion,
} from "../diag/types.ts"

type CapAnn = ParsedAnnotation & { kind: "cap" }
type EffectsAnn = ParsedAnnotation & { kind: "effects" }

type CalleeEntry = {
  caps: ReadonlyArray<{ pos: number; cap: CapAnn }>
}

type Ctx = {
  diagnostics: Diagnostic[]
  calleeCache: Map<Node, CalleeEntry>
}

/**
 * @hewg-module analysis/cap-flow
 * @effects
 */
export function runCapFlow(index: SymbolIndex): Diagnostic[] {
  const ctx: Ctx = { diagnostics: [], calleeCache: new Map() }

  for (const hit of index.hits) {
    const parsed = parseAnnotations(hit.decl)
    const callerParams = hit.fn.getParameters()
    const callerCaps = filterCaps(parsed.annotations, callerParams)
    const callerParamSet = new Set<ParameterDeclaration>(callerParams)
    const callerEffects = findEffects(parsed.annotations)

    for (const call of hit.fn.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      analyzeCall(call, hit, callerCaps, callerParamSet, callerEffects, ctx)
    }
  }

  return ctx.diagnostics
}

function analyzeCall(
  call: CallExpression,
  callerHit: ExportHit,
  callerCaps: ReadonlyMap<string, CapAnn>,
  callerParamSet: ReadonlySet<ParameterDeclaration>,
  callerEffects: EffectsAnn | undefined,
  ctx: Ctx,
): void {
  const expr = call.getExpression()
  if (expr.getKind() !== SyntaxKind.Identifier) return
  const id = expr as Identifier

  const calleeDecl = resolveCalleeDecl(id)
  if (calleeDecl === undefined) return

  const entry = getCalleeEntry(calleeDecl, ctx)
  if (entry.caps.length === 0) return

  const args = call.getArguments()
  const calleeLabel = id.getText()
  const out = ctx.diagnostics

  for (const { pos, cap: calleeCap } of entry.caps) {
    const emitMissing = (): void => {
      out.push(
        makeE0402({
          calleeLabel,
          calleeId: id,
          calleeCap,
          callerHit,
          callerEffects,
        }),
      )
    }

    const arg = args[pos]
    if (arg === undefined || arg.getKind() !== SyntaxKind.Identifier) {
      emitMissing()
      continue
    }

    const argId = arg as Identifier
    const argParam = resolveCallerParameter(argId, callerParamSet)
    if (argParam === undefined) {
      emitMissing()
      continue
    }

    const argParamName = argParam.getName()
    const callerCap = callerCaps.get(argParamName)
    if (callerCap === undefined) {
      emitMissing()
      continue
    }

    if (argParamName !== calleeCap.param) {
      out.push(
        makeE0403({
          argId,
          argName: argParamName,
          expectedName: calleeCap.param,
          calleeCap,
        }),
      )
      continue
    }

    if (
      callerCap.effectKind !== calleeCap.effectKind ||
      callerCap.effect !== calleeCap.effect
    ) {
      out.push(makeE0401Effect({ argId, callerCap, calleeCap }))
      continue
    }

    if (!scopeSatisfies(callerCap.scope, calleeCap.scope)) {
      out.push(makeE0401Scope({ argId, callerCap, calleeCap }))
    }
  }
}

// --- Scope compatibility ---------------------------------------------------
//
// Caller's scope is at-least-as-permissive as the callee's iff every
// constrained callee field is also constrained by the caller in a way that
// covers it. Omitted caller fields = wildcard. Does not compare effect
// strings — that is the caller's responsibility.

/**
 * @effects
 */
export function scopeSatisfies(caller: CapScope, callee: CapScope): boolean {
  if (caller.kind !== callee.kind) return false
  return findScopeMismatch(caller, callee) === null
}

type ScopeMismatch = {
  field: string
  callerVal: string | number | readonly string[] | undefined
  calleeVal: string | number | readonly string[]
}

function findScopeMismatch(
  caller: CapScope,
  callee: CapScope,
): ScopeMismatch | null {
  if (caller.kind === "net" && callee.kind === "net") {
    if (
      callee.host !== undefined &&
      caller.host !== undefined &&
      caller.host !== callee.host
    ) {
      return { field: "host", callerVal: caller.host, calleeVal: callee.host }
    }
    if (
      callee.port !== undefined &&
      caller.port !== undefined &&
      caller.port !== callee.port
    ) {
      return { field: "port", callerVal: caller.port, calleeVal: callee.port }
    }
    if (
      callee.pathPrefix !== undefined &&
      caller.pathPrefix !== undefined &&
      !callee.pathPrefix.startsWith(caller.pathPrefix)
    ) {
      return {
        field: "path_prefix",
        callerVal: caller.pathPrefix,
        calleeVal: callee.pathPrefix,
      }
    }
    return null
  }
  if (caller.kind === "fs" && callee.kind === "fs") {
    if (
      callee.prefix !== undefined &&
      caller.prefix !== undefined &&
      !callee.prefix.startsWith(caller.prefix)
    ) {
      return {
        field: "prefix",
        callerVal: caller.prefix,
        calleeVal: callee.prefix,
      }
    }
    return null
  }
  if (caller.kind === "proc" && callee.kind === "proc") {
    const have = new Set(caller.cmdAllowlist ?? [])
    for (const cmd of callee.cmdAllowlist ?? []) {
      if (!have.has(cmd)) {
        return {
          field: "cmd_allowlist",
          callerVal: caller.cmdAllowlist ?? [],
          calleeVal: callee.cmdAllowlist ?? [],
        }
      }
    }
    return null
  }
  return null
}

// --- Callee entry (cached) -------------------------------------------------

function getCalleeEntry(
  decl: FunctionDeclaration | MethodDeclaration | VariableDeclaration,
  ctx: Ctx,
): CalleeEntry {
  const cached = ctx.calleeCache.get(decl)
  if (cached !== undefined) return cached
  const entry = buildCalleeEntry(decl)
  ctx.calleeCache.set(decl, entry)
  return entry
}

function buildCalleeEntry(
  decl: FunctionDeclaration | MethodDeclaration | VariableDeclaration,
): CalleeEntry {
  const fnLike = functionLikeFor(decl)
  if (fnLike === undefined) return { caps: [] }
  const params = fnLike.getParameters()
  const paramIndex = new Map<string, number>()
  params.forEach((p, i) => paramIndex.set(p.getName(), i))

  const parsed = parseAnnotations(jsDocableCarrier(decl))
  const caps: Array<{ pos: number; cap: CapAnn }> = []
  const seen = new Set<string>()
  for (const a of parsed.annotations) {
    if (a.kind !== "cap") continue
    const pos = paramIndex.get(a.param)
    if (pos === undefined) continue
    if (seen.has(a.param)) continue
    seen.add(a.param)
    caps.push({ pos, cap: a })
  }
  return { caps }
}

function filterCaps(
  anns: readonly ParsedAnnotation[],
  params: readonly ParameterDeclaration[],
): Map<string, CapAnn> {
  const paramNames = new Set(params.map((p) => p.getName()))
  const out = new Map<string, CapAnn>()
  for (const a of anns) {
    if (a.kind !== "cap") continue
    if (!paramNames.has(a.param)) continue
    if (out.has(a.param)) continue
    out.set(a.param, a)
  }
  return out
}

function findEffects(
  anns: readonly ParsedAnnotation[],
): EffectsAnn | undefined {
  for (const a of anns) if (a.kind === "effects") return a
  return undefined
}

// --- Callee / caller resolution -------------------------------------------

function resolveCalleeDecl(
  id: Identifier,
):
  | FunctionDeclaration
  | MethodDeclaration
  | VariableDeclaration
  | undefined {
  const sym = id.getSymbol()
  if (sym === undefined) return undefined
  const decls: Node[] = [...sym.getDeclarations()]
  const aliased = sym.getAliasedSymbol()
  if (aliased !== undefined) {
    for (const d of aliased.getDeclarations()) decls.push(d)
  }
  for (const decl of decls) {
    const dk = decl.getKind()
    if (
      (dk === SyntaxKind.FunctionDeclaration ||
        dk === SyntaxKind.MethodDeclaration) &&
      isProjectDecl(decl)
    ) {
      const fn = decl as FunctionDeclaration | MethodDeclaration
      if (fn.getBody() === undefined) continue
      return fn
    }
    if (dk === SyntaxKind.VariableDeclaration) {
      const vd = decl as VariableDeclaration
      if (isProjectDecl(vd) && functionLikeFor(vd) !== undefined) return vd
    }
  }
  return undefined
}

function resolveCallerParameter(
  argId: Identifier,
  callerParams: ReadonlySet<ParameterDeclaration>,
): ParameterDeclaration | undefined {
  const sym = argId.getSymbol()
  if (sym === undefined) return undefined
  for (const decl of sym.getDeclarations()) {
    if (decl.getKind() !== SyntaxKind.Parameter) continue
    const param = decl as ParameterDeclaration
    if (callerParams.has(param)) return param
  }
  return undefined
}

function functionLikeFor(
  decl: FunctionDeclaration | MethodDeclaration | VariableDeclaration,
): ExportedFunctionLike | undefined {
  if (decl.getKind() === SyntaxKind.VariableDeclaration) {
    const init = (decl as VariableDeclaration).getInitializer()
    if (init === undefined) return undefined
    const ik = init.getKind()
    if (
      ik === SyntaxKind.ArrowFunction ||
      ik === SyntaxKind.FunctionExpression
    ) {
      return init as ExportedFunctionLike
    }
    return undefined
  }
  return decl as ExportedFunctionLike
}

function jsDocableCarrier(
  decl: FunctionDeclaration | MethodDeclaration | VariableDeclaration,
): Node & JSDocableNode {
  if (decl.getKind() === SyntaxKind.VariableDeclaration) {
    const stmt = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement)
    if (stmt !== undefined) return stmt as Node & JSDocableNode
  }
  return decl as Node & JSDocableNode
}

function isProjectDecl(decl: Node): boolean {
  const sf = decl.getSourceFile()
  if (sf.isDeclarationFile()) return false
  return !sf.getFilePath().includes("/node_modules/")
}

// --- Spans -----------------------------------------------------------------

function nodeSpan(n: Node): Span {
  const sf = n.getSourceFile()
  const start = n.getStart()
  const { line, column } = sf.getLineAndColumnAtPos(start)
  return { file: sf.getFilePath(), line, col: column, len: n.getEnd() - start }
}

// --- Diagnostic constructors ----------------------------------------------

function makeE0402(input: {
  calleeLabel: string
  calleeId: Identifier
  calleeCap: CapAnn
  callerHit: ExportHit
  callerEffects: EffectsAnn | undefined
}): Diagnostic {
  const info = DIAGNOSTIC_REGISTRY.E0402
  const span = nodeSpan(input.calleeId)
  const insertionSpan = suggestionInsertionSpan(input.callerHit, input.callerEffects)
  const suggest: Suggestion[] = [
    {
      kind: "add-cap",
      rationale: "add an @cap annotation for the caller",
      at: insertionSpan,
      insert: ` * @cap ${input.calleeCap.param} ${input.calleeCap.effect}${scopeHint(input.calleeCap.scope)}\n`,
    },
  ]
  return {
    code: "E0402",
    severity: info.severity,
    file: span.file,
    line: span.line,
    col: span.col,
    len: span.len,
    message: `callee \`${input.calleeLabel}\` requires @cap \`${input.calleeCap.param}\`; add an @cap on this function (or its nearest ancestor that owns the capability)`,
    suggest,
    docs: info.docsUrl,
  }
}

function makeE0403(input: {
  argId: Identifier
  argName: string
  expectedName: string
  calleeCap: CapAnn
}): Diagnostic {
  const info = DIAGNOSTIC_REGISTRY.E0403
  const span = nodeSpan(input.argId)
  const suggest: Suggestion[] = [
    {
      kind: "rename-arg",
      rationale: "rename the argument to match the capability parameter",
      at: span,
      insert: input.expectedName,
    },
  ]
  return {
    code: "E0403",
    severity: info.severity,
    file: span.file,
    line: span.line,
    col: span.col,
    len: span.len,
    message: `capability argument \`${input.argName}\` does not match parameter name \`${input.expectedName}\` expected by callee`,
    suggest,
    docs: info.docsUrl,
  }
}

function makeE0401Scope(input: {
  argId: Identifier
  callerCap: CapAnn
  calleeCap: CapAnn
}): Diagnostic {
  const mismatch = findScopeMismatch(input.callerCap.scope, input.calleeCap.scope)
  const detail =
    mismatch === null
      ? `callee requires ${input.calleeCap.effect}, caller provides ${input.callerCap.effect}`
      : `callee requires ${mismatch.field}=${JSON.stringify(mismatch.calleeVal)}, caller provides ${mismatch.field}=${mismatch.callerVal === undefined ? "*" : JSON.stringify(mismatch.callerVal)}`
  const replacement = `@cap ${input.callerCap.param} ${input.calleeCap.effect}${scopeHint(input.calleeCap.scope)}`
  return makeE0401(
    input.argId,
    input.calleeCap,
    `capability scope too narrow: ${detail}`,
    [
      {
        kind: "narrow-cap",
        rationale: "tighten the caller's capability scope to match the callee",
        at: input.callerCap.span,
        insert: replacement,
      },
    ],
  )
}

function makeE0401Effect(input: {
  argId: Identifier
  callerCap: CapAnn
  calleeCap: CapAnn
}): Diagnostic {
  return makeE0401(
    input.argId,
    input.calleeCap,
    `capability effect mismatch: callee requires \`${input.calleeCap.effect}\`, caller provides \`${input.callerCap.effect}\``,
  )
}

function makeE0401(
  argId: Identifier,
  calleeCap: CapAnn,
  message: string,
  suggest?: Suggestion[],
): Diagnostic {
  const info = DIAGNOSTIC_REGISTRY.E0401
  const span = nodeSpan(argId)
  const related: RelatedInfo[] = [
    {
      file: calleeCap.span.file,
      line: calleeCap.span.line,
      col: calleeCap.span.col,
      len: calleeCap.span.len,
      message: "callee requires @cap here",
    },
  ]
  const d: Diagnostic = {
    code: "E0401",
    severity: info.severity,
    file: span.file,
    line: span.line,
    col: span.col,
    len: span.len,
    message,
    related,
    docs: info.docsUrl,
  }
  if (suggest !== undefined) d.suggest = suggest
  return d
}

function scopeHint(scope: CapScope): string {
  const parts: string[] = []
  if (scope.kind === "net") {
    if (scope.host !== undefined) parts.push(`host="${scope.host}"`)
    if (scope.port !== undefined) parts.push(`port=${scope.port}`)
    if (scope.pathPrefix !== undefined) {
      parts.push(`path_prefix="${scope.pathPrefix}"`)
    }
  } else if (scope.kind === "fs") {
    if (scope.prefix !== undefined) parts.push(`prefix="${scope.prefix}"`)
  } else if (scope.kind === "proc") {
    if (scope.cmdAllowlist !== undefined && scope.cmdAllowlist.length > 0) {
      for (const c of scope.cmdAllowlist) parts.push(`cmd_allowlist="${c}"`)
    }
  }
  return parts.length === 0 ? "" : ` ${parts.join(" ")}`
}

function suggestionInsertionSpan(
  hit: ExportHit,
  effects: EffectsAnn | undefined,
): Span {
  if (effects !== undefined) {
    return {
      file: effects.span.file,
      line: effects.span.line + 1,
      col: 1,
      len: 0,
    }
  }
  const sf = hit.file
  const start = hit.decl.getStart()
  const { line, column } = sf.getLineAndColumnAtPos(start)
  return { file: sf.getFilePath(), line, col: column, len: 0 }
}
