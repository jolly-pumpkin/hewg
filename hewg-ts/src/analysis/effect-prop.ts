// Effect propagation pass.
//
// For every annotated function in the project, compute the union of effects
// observed through its call graph and compare against the declared @effects row.
//
// Emits:
//   - E0301: observed effect not declared
//   - E0302: declared effect never observed (suppressed if an @cap on the same
//            function names that effect — the cap implies the effect by design)
//   - W0003: callee resolves to neither the effect map nor a user function
//
// E0303 (override widening) is stubbed in v0; full override analysis is v1.

import type {
  ArrowFunction,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  JSDocableNode,
  MethodDeclaration,
  Node,
  Project,
  PropertyAccessExpression,
  SourceFile,
  Symbol as TsMorphSymbol,
  Type,
  VariableDeclaration,
} from "ts-morph"
import { SyntaxKind } from "ts-morph"
import { parseAnnotations } from "../annotations/parser.ts"
import type {
  EffectName,
  ParsedAnnotation,
} from "../annotations/types.ts"
import type { ExportHit, SymbolIndex } from "../contract/lookup.ts"
import { DIAGNOSTIC_REGISTRY } from "../diag/codes.ts"
import type { Diagnostic, RelatedInfo, Span, Suggestion } from "../diag/types.ts"
import type { PackageConfig, PackagePolicy, UnknownEffectPolicy } from "../config.ts"
import type { EffectMap } from "./effect-map.ts"

export type EffectPropOptions = {
  effectMap: EffectMap
  depthLimit: number
  unknownEffectPolicy: UnknownEffectPolicy
  packages?: Record<string, PackageConfig>
  defaultPackagePolicy?: PackagePolicy
}

type FnLike = FunctionDeclaration | ArrowFunction | FunctionExpression | MethodDeclaration

type Ctx = {
  project: Project
  index: SymbolIndex
  effectMap: EffectMap
  depthLimit: number
  unknownPolicy: UnknownEffectPolicy
  packages: Record<string, PackageConfig>
  defaultPackagePolicy: PackagePolicy | undefined
  visited: Set<string>
  memo: Map<string, ReadonlySet<EffectName>>
  diagnostics: Diagnostic[]
}

const NODE_BUILTINS = new Set([
  "fs",
  "fs/promises",
  "path",
  "http",
  "https",
  "crypto",
  "child_process",
  "process",
  "os",
  "net",
  "tls",
  "url",
  "stream",
  "zlib",
  "dns",
])

/**
 * @hewg-module analysis/effect-prop
 * @effects
 */
export function runEffectPropagation(
  project: Project,
  index: SymbolIndex,
  opts: EffectPropOptions,
): Diagnostic[] {
  const ctx: Ctx = {
    project,
    index,
    effectMap: opts.effectMap,
    depthLimit: opts.depthLimit,
    unknownPolicy: opts.unknownEffectPolicy,
    packages: opts.packages ?? {},
    defaultPackagePolicy: opts.defaultPackagePolicy,
    visited: new Set(),
    memo: new Map(),
    diagnostics: [],
  }

  for (const hit of index.hits) {
    const parsed = parseAnnotations(hit.decl)
    const effectsAnn = findEffectsAnnotation(parsed.annotations)
    if (effectsAnn === undefined) continue
    analyzeDeclaredFunction(hit, parsed.annotations, effectsAnn, ctx)
  }

  return ctx.diagnostics
}

function findEffectsAnnotation(
  anns: readonly ParsedAnnotation[],
): (ParsedAnnotation & { kind: "effects" }) | undefined {
  for (const a of anns) if (a.kind === "effects") return a
  return undefined
}

function analyzeDeclaredFunction(
  hit: ExportHit,
  annotations: readonly ParsedAnnotation[],
  effectsAnn: ParsedAnnotation & { kind: "effects" },
  ctx: Ctx,
): void {
  const declared: ReadonlySet<EffectName> = new Set(effectsAnn.effects)
  const perCall: { effect: EffectName; callSpan: Span; calleeLabel: string }[] = []
  const observedBuilder = new Set<EffectName>()

  for (const call of hit.fn.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const resolved = resolveCall(call, ctx, 0)
    const span = callExpressionSpan(call)
    const label = calleeText(call)
    for (const e of resolved) {
      observedBuilder.add(e)
      perCall.push({ effect: e, callSpan: span, calleeLabel: label })
    }
  }

  const effectSpans = effectsAnn.effectSpans

  // E0301: each observed effect that is NOT declared → one diagnostic per call site
  for (const entry of perCall) {
    if (declared.has(entry.effect)) continue
    ctx.diagnostics.push(
      makeE0301({
        effect: entry.effect,
        calleeLabel: entry.calleeLabel,
        callSpan: entry.callSpan,
        effectsAnn,
        effectSpans,
        declared: effectsAnn.effects,
      }),
    )
  }

  // E0302: declared effects that never appear in observed, unless an @cap declares them
  const capEffects = new Set<EffectName>()
  for (const a of annotations) if (a.kind === "cap") capEffects.add(a.effect)
  for (let i = 0; i < effectsAnn.effects.length; i++) {
    const e = effectsAnn.effects[i]!
    if (observedBuilder.has(e)) continue
    if (capEffects.has(e)) continue
    const span = effectSpans[i] ?? effectsAnn.span
    ctx.diagnostics.push(makeE0302(e, span))
  }
}

// --- Public callee-effects query -------------------------------------------

export type CalleeEffectEntry = {
  label: string
  effects: ReadonlySet<EffectName>
}

/**
 * For a given function body, resolve each call expression and return a map
 * of callee label → observed effects. This is the shared primitive used by
 * the CLAUDE.md generator, `hewg infer`, and `hewg scope`.
 *
 * @hewg-module analysis/effect-prop
 * @effects
 */
export function resolveCalleeEffects(
  fnLike: FnLike,
  project: Project,
  index: SymbolIndex,
  opts: EffectPropOptions,
): CalleeEffectEntry[] {
  const ctx: Ctx = {
    project,
    index,
    effectMap: opts.effectMap,
    depthLimit: opts.depthLimit,
    unknownPolicy: opts.unknownEffectPolicy,
    packages: opts.packages ?? {},
    defaultPackagePolicy: opts.defaultPackagePolicy,
    visited: new Set(),
    memo: new Map(),
    diagnostics: [], // discarded — this is a query, not a diagnostic pass
  }

  const entries: CalleeEffectEntry[] = []
  for (const call of fnLike.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const resolved = resolveCall(call, ctx, 0)
    const label = calleeText(call)
    entries.push({ label, effects: resolved })
  }
  return entries
}

// Re-export FnLike so callers can reference it
export type { FnLike }

// --- Call resolution -------------------------------------------------------

type ResolveResult = ReadonlySet<EffectName>

function resolveCall(call: CallExpression, ctx: Ctx, depth: number): ResolveResult {
  const expr = call.getExpression()
  const kind = expr.getKind()

  if (kind === SyntaxKind.PropertyAccessExpression) {
    return resolvePropertyAccess(call, expr as PropertyAccessExpression, ctx, depth)
  }
  if (kind === SyntaxKind.Identifier) {
    return resolveIdentifier(call, expr as Identifier, ctx, depth)
  }
  return emitUnknown(call, ctx)
}

const EMPTY_SET: ReadonlySet<EffectName> = new Set()

function resolvePropertyAccess(
  call: CallExpression,
  pae: PropertyAccessExpression,
  ctx: Ctx,
  depth: number,
): ResolveResult {
  const member = pae.getName()
  const obj = pae.getExpression()

  // Strategy 1: namespace import (import * as fs from "node:fs")
  if (obj.getKind() === SyntaxKind.Identifier) {
    const sym = (obj as Identifier).getSymbol()
    if (sym !== undefined) {
      for (const decl of sym.getDeclarations()) {
        if (decl.getKind() === SyntaxKind.NamespaceImport) {
          const importDecl = decl.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
          if (importDecl !== undefined) {
            const spec = importDecl.getModuleSpecifierValue()
            if (spec !== undefined) {
              const key = normalizeModule(spec) + "." + member
              return mapLookupOrUnknown(key, call, ctx, packageFromSpec(spec))
            }
          }
        }
      }
    }
  }

  // Strategy 2: literal text key (handles console.log, Math.random, etc.)
  const textKey = obj.getText() + "." + member
  const textEffects = ctx.effectMap.effectsOf(textKey)
  if (textEffects !== undefined) return new Set(textEffects)

  // Strategy 3: type-based resolution
  const typeResult = resolveViaType(obj, member, call, ctx, depth)
  if (typeResult.effects !== undefined) return typeResult.effects

  // All strategies failed
  return emitUnknown(call, ctx, typeResult.pkg)
}

function resolveViaType(
  obj: Node,
  member: string,
  call: CallExpression,
  ctx: Ctx,
  depth: number,
): { effects?: ResolveResult; pkg?: string } {
  let type: Type
  try {
    type = obj.getType()
  } catch {
    return {}
  }
  if (type.isAny() || type.isUnknown()) return {}

  const effective = unwrapType(type)
  if (effective === undefined) return {}

  // Try getSymbol() first; fall back to getApparentType() for primitives
  // (e.g., `string` has no symbol, but its apparent type `String` does)
  let sym = effective.getSymbol()
  if (sym === undefined) {
    sym = effective.getApparentType().getSymbol() ?? undefined
  }
  if (sym === undefined) return {}

  const name = sym.getName()
  if (name === "__type" || name === "__object") return {}

  // Check if this is a built-in JS type (from TypeScript's lib.*.d.ts)
  if (isLibType(sym)) return { effects: EMPTY_SET }

  // Check if from node_modules — construct package-qualified key
  const pkg = getPackageName(sym)
  if (pkg !== undefined) {
    const key = pkg + "." + name + "." + member
    const effects = ctx.effectMap.effectsOf(key)
    if (effects !== undefined) return { effects: new Set(effects), pkg }
  }

  // User-code type: try to resolve the method declaration and walk its body
  const methodResult = resolveMethodOnType(sym, member, ctx, depth)
  if (methodResult !== undefined) return { effects: methodResult, pkg }

  return { pkg }
}

function unwrapType(type: Type): Type | undefined {
  if (type.isUnion()) {
    const stripped = type.getNonNullableType()
    if (stripped.isUnion()) return undefined // true union, ambiguous
    return unwrapType(stripped)
  }
  return type.getTargetType() ?? type
}

function isLibType(sym: TsMorphSymbol): boolean {
  for (const decl of sym.getDeclarations()) {
    const path = decl.getSourceFile().getFilePath()
    if (path.includes("/typescript/lib/lib.")) return true
  }
  return false
}

function getPackageName(sym: TsMorphSymbol): string | undefined {
  for (const decl of sym.getDeclarations()) {
    const path = decl.getSourceFile().getFilePath()
    const nmIdx = path.lastIndexOf("/node_modules/")
    if (nmIdx === -1) continue
    const afterNm = path.slice(nmIdx + "/node_modules/".length)
    let pkg: string
    if (afterNm.startsWith("@")) {
      const parts = afterNm.split("/")
      pkg = parts[0] + "/" + parts[1]
    } else {
      pkg = afterNm.split("/")[0]
    }
    if (pkg.startsWith("@types/")) pkg = pkg.slice("@types/".length)
    return pkg
  }
  return undefined
}

function resolveMethodOnType(
  typeSym: TsMorphSymbol,
  member: string,
  ctx: Ctx,
  depth: number,
): ResolveResult | undefined {
  for (const decl of typeSym.getDeclarations()) {
    if (!isProjectDecl(decl)) continue
    const methods = decl.getDescendantsOfKind(SyntaxKind.MethodDeclaration)
    for (const m of methods) {
      if (m.getName() === member && hasCallableBody(m)) {
        return resolveUserFn(m, ctx, depth)
      }
    }
  }
  return undefined
}

function resolveIdentifier(
  call: CallExpression,
  id: Identifier,
  ctx: Ctx,
  depth: number,
): ResolveResult {
  const sym = id.getSymbol()
  if (sym !== undefined) {
    // Walk both the declarations and the aliased symbol's declarations so
    // `import { foo } from "./foo.ts"` resolves to the actual FunctionDeclaration.
    const decls = collectAllDeclarations(sym)
    for (const decl of decls) {
      const dk = decl.getKind()
      if (
        (dk === SyntaxKind.FunctionDeclaration ||
          dk === SyntaxKind.MethodDeclaration) &&
        isProjectDecl(decl) &&
        hasCallableBody(decl as FunctionDeclaration | MethodDeclaration)
      ) {
        return resolveUserFn(decl as FunctionDeclaration | MethodDeclaration, ctx, depth)
      }
      if (dk === SyntaxKind.VariableDeclaration) {
        const vd = decl as VariableDeclaration
        if (isProjectDecl(vd)) {
          const init = vd.getInitializer()
          if (init !== undefined) {
            const ik = init.getKind()
            if (ik === SyntaxKind.ArrowFunction || ik === SyntaxKind.FunctionExpression) {
              return resolveUserFn(vd, ctx, depth)
            }
          }
        }
      }
    }

    // Non-project import: try to build an effect-map key from the import source.
    for (const decl of decls) {
      if (decl.getKind() === SyntaxKind.ImportSpecifier) {
        const importDecl = decl.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
        if (importDecl !== undefined) {
          const spec = importDecl.getModuleSpecifierValue()
          if (spec !== undefined && !isRelativeSpecifier(spec)) {
            const imported = decl.getFirstChildByKind(SyntaxKind.Identifier)?.getText() ?? id.getText()
            const key = normalizeModule(spec) + "." + imported
            return mapLookupOrUnknown(key, call, ctx, packageFromSpec(spec))
          }
        }
      }
    }
  }

  // Unresolved identifier: treat as a map key (covers `fetch`).
  const key = id.getText()
  return mapLookupOrUnknown(key, call, ctx)
}

function collectAllDeclarations(sym: import("ts-morph").Symbol): Node[] {
  const out: Node[] = []
  for (const d of sym.getDeclarations()) out.push(d)
  const aliased = sym.getAliasedSymbol?.()
  if (aliased !== undefined) {
    for (const d of aliased.getDeclarations()) out.push(d)
  }
  return out
}

function hasCallableBody(
  fn: FunctionDeclaration | MethodDeclaration,
): boolean {
  // Ambient `declare function foo(): void` has no body; don't walk into it.
  return fn.getBody() !== undefined
}

function isRelativeSpecifier(spec: string): boolean {
  return spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")
}

function packageFromSpec(spec: string): string | undefined {
  if (spec.startsWith("node:") || spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")) return undefined
  if (spec.startsWith("@")) {
    const parts = spec.split("/")
    return parts.length >= 2 ? parts[0] + "/" + parts[1] : undefined
  }
  return spec.split("/")[0]
}

function resolvePackagePolicy(pkg: string | undefined, ctx: Ctx): UnknownEffectPolicy {
  if (pkg !== undefined) {
    const pkgCfg = ctx.packages[pkg]
    if (pkgCfg !== undefined) return pkgCfg.defaultPolicy
    if (ctx.defaultPackagePolicy !== undefined) return ctx.defaultPackagePolicy
  }
  return ctx.unknownPolicy
}

function mapLookupOrUnknown(
  key: string,
  call: CallExpression,
  ctx: Ctx,
  pkg?: string,
): ResolveResult {
  const effects = ctx.effectMap.effectsOf(key)
  if (effects !== undefined) return new Set(effects)
  return emitUnknown(call, ctx, pkg)
}

function emitUnknown(call: CallExpression, ctx: Ctx, pkg?: string): ResolveResult {
  const policy = resolvePackagePolicy(pkg, ctx)
  if (policy === "warn") {
    ctx.diagnostics.push(makeW0003(call))
  }
  return new Set<EffectName>()
}

function resolveUserFn(
  decl:
    | FunctionDeclaration
    | MethodDeclaration
    | VariableDeclaration,
  ctx: Ctx,
  depth: number,
): ResolveResult {
  const jsdocNode: Node & JSDocableNode = jsDocableCarrier(decl)
  const fnLike = functionLikeFor(decl)
  if (fnLike === undefined) return new Set()

  const parsed = parseAnnotations(jsdocNode)
  const eff = findEffectsAnnotation(parsed.annotations)
  if (eff !== undefined) {
    return new Set(eff.effects)
  }

  // Unannotated user code → recurse with cycle detection & depth limit.
  const key = nodeKey(fnLike)
  const cached = ctx.memo.get(key)
  if (cached !== undefined) return cached
  if (ctx.visited.has(key)) return new Set()
  if (depth >= ctx.depthLimit) return new Set()

  ctx.visited.add(key)
  const acc = new Set<EffectName>()
  for (const inner of fnLike.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    for (const e of resolveCall(inner, ctx, depth + 1)) acc.add(e)
  }
  ctx.visited.delete(key)
  ctx.memo.set(key, acc)
  return acc
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

function functionLikeFor(
  decl: FunctionDeclaration | MethodDeclaration | VariableDeclaration,
): FnLike | undefined {
  if (decl.getKind() === SyntaxKind.VariableDeclaration) {
    const init = (decl as VariableDeclaration).getInitializer()
    if (init === undefined) return undefined
    const ik = init.getKind()
    if (ik === SyntaxKind.ArrowFunction) return init as ArrowFunction
    if (ik === SyntaxKind.FunctionExpression) return init as FunctionExpression
    return undefined
  }
  return decl as FnLike
}

function isProjectDecl(decl: Node): boolean {
  const sf = decl.getSourceFile()
  if (sf.isDeclarationFile()) return false
  const path = sf.getFilePath()
  return !path.includes("/node_modules/")
}

// --- Module specifier normalization ---------------------------------------

function normalizeModule(spec: string): string {
  if (spec.startsWith("node:")) return spec
  if (NODE_BUILTINS.has(spec)) return "node:" + spec
  return spec
}

// --- Span helpers ----------------------------------------------------------

function callExpressionSpan(call: CallExpression): Span {
  const sf = call.getSourceFile()
  const callee = call.getExpression()
  const start = callee.getStart()
  const len = callee.getEnd() - start
  const { line, column } = sf.getLineAndColumnAtPos(start)
  return { file: sf.getFilePath(), line, col: column, len }
}

function calleeText(call: CallExpression): string {
  return call.getExpression().getText()
}

function nodeKey(node: Node): string {
  return node.getSourceFile().getFilePath() + "#" + node.getStart()
}

// --- Diagnostic constructors ----------------------------------------------

function makeE0301(input: {
  effect: EffectName
  calleeLabel: string
  callSpan: Span
  effectsAnn: ParsedAnnotation & { kind: "effects" }
  effectSpans: readonly Span[]
  declared: readonly EffectName[]
}): Diagnostic {
  const info = DIAGNOSTIC_REGISTRY.E0301
  const { effect, calleeLabel, callSpan, effectsAnn, effectSpans, declared } = input
  const declaredStr = declared.join(", ")
  const lastIdx = effectSpans.length - 1
  const lastSpan = effectSpans[lastIdx] ?? effectsAnn.span

  const related: RelatedInfo[] = [
    {
      file: lastSpan.file,
      line: lastSpan.line,
      col: lastSpan.col,
      len: lastSpan.len,
      message: "effect row declared here",
    },
  ]

  const suggest: Suggestion[] = [
    {
      kind: "add-effect",
      rationale: "declare the effect",
      at: {
        file: lastSpan.file,
        line: lastSpan.line,
        col: lastSpan.col + lastSpan.len,
        len: 0,
      },
      insert: `, ${effect}`,
    },
    {
      kind: "add-cap",
      rationale: "add an @cap so the caller threads this capability (preferred for library code)",
      at: {
        file: effectsAnn.span.file,
        line: effectsAnn.span.line + 1,
        col: 1,
        len: 0,
      },
      insert: ` * @cap ${paramHint(effect)} ${effect}${scopeHint(effect)}\n`,
    },
  ]

  return {
    code: "E0301",
    severity: info.severity,
    file: callSpan.file,
    line: callSpan.line,
    col: callSpan.col,
    len: callSpan.len,
    message: `call to \`${calleeLabel}\` performs effect \`${effect}\`, not declared in @effects \`${declaredStr}\``,
    related,
    suggest,
    docs: info.docsUrl,
  }
}

function paramHint(effect: EffectName): string {
  if (effect.startsWith("fs.")) return "fs"
  if (effect.startsWith("net.")) return "http"
  if (effect.startsWith("proc.")) return "proc"
  if (effect === "log") return "log"
  if (effect === "rand") return "rand"
  if (effect.startsWith("time.")) return "time"
  return "cap"
}

function scopeHint(effect: EffectName): string {
  if (effect === "fs.read") return ` prefix="./receipts/"`
  if (effect === "fs.write") return ` prefix="./receipts/"`
  if (effect.startsWith("net.")) return ` host="api.example.com"`
  return ""
}

function makeE0302(effect: EffectName, span: Span): Diagnostic {
  const info = DIAGNOSTIC_REGISTRY.E0302
  return {
    code: "E0302",
    severity: info.severity,
    file: span.file,
    line: span.line,
    col: span.col,
    len: span.len,
    message: `@effects declares \`${effect}\` but no call in the body produces it (and no @cap covers it)`,
    suggest: [
      {
        kind: "remove-effect",
        rationale: "drop the unused effect",
        at: { file: span.file, line: span.line, col: Math.max(1, span.col - 1), len: span.len + 1 },
        insert: "",
      },
    ],
    docs: info.docsUrl,
  }
}

function makeW0003(call: CallExpression): Diagnostic {
  const info = DIAGNOSTIC_REGISTRY.W0003
  const span = callExpressionSpan(call)
  const label = calleeText(call)
  return {
    code: "W0003",
    severity: info.severity,
    file: span.file,
    line: span.line,
    col: span.col,
    len: span.len,
    message: `callee \`${label}\` is not in the effect map; if it is pure, add an entry with effects: [] in hewg.config.json`,
    notes: [
      { message: "add an effect-map entry in hewg.config.json, or annotate the callee" },
    ],
    docs: info.docsUrl,
  }
}
