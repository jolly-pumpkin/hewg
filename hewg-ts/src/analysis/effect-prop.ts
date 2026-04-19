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
import type { UnknownEffectPolicy } from "../config.ts"
import type { EffectMap } from "./effect-map.ts"

export type EffectPropOptions = {
  effectMap: EffectMap
  depthLimit: number
  unknownEffectPolicy: UnknownEffectPolicy
}

type FnLike = FunctionDeclaration | ArrowFunction | FunctionExpression | MethodDeclaration

type Ctx = {
  project: Project
  index: SymbolIndex
  effectMap: EffectMap
  depthLimit: number
  unknownPolicy: UnknownEffectPolicy
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

function resolvePropertyAccess(
  call: CallExpression,
  pae: PropertyAccessExpression,
  ctx: Ctx,
  depth: number,
): ResolveResult {
  const member = pae.getName()
  const obj = pae.getExpression()

  // Check whether `obj` is a namespace import (import * as fs from "node:fs")
  if (obj.getKind() === SyntaxKind.Identifier) {
    const sym = (obj as Identifier).getSymbol()
    if (sym !== undefined) {
      for (const decl of sym.getDeclarations()) {
        if (decl.getKind() === SyntaxKind.NamespaceImport) {
          // NamespaceImport -> ImportClause -> ImportDeclaration
          const importDecl = decl.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
          if (importDecl !== undefined) {
            const spec = importDecl.getModuleSpecifierValue()
            if (spec !== undefined) {
              const key = normalizeModule(spec) + "." + member
              return mapLookupOrUnknown(key, call, ctx)
            }
          }
        }
      }
    }
  }

  // Fallback: literal object text + "." + member. Covers `console.log`,
  // `Math.random`, `crypto.getRandomValues`, `localStorage.setItem`.
  const key = obj.getText() + "." + member
  return mapLookupOrUnknown(key, call, ctx)
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
            return mapLookupOrUnknown(key, call, ctx)
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

function mapLookupOrUnknown(
  key: string,
  call: CallExpression,
  ctx: Ctx,
): ResolveResult {
  const effects = ctx.effectMap.effectsOf(key)
  if (effects !== undefined) return new Set(effects)
  return emitUnknown(call, ctx)
}

function emitUnknown(call: CallExpression, ctx: Ctx): ResolveResult {
  if (ctx.unknownPolicy === "warn") {
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
      rationale: "thread a capability of the right kind from the caller",
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
    message: `declared effect \`${effect}\` is never used in the function body`,
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
    message: `effect of callee \`${label}\` unknown; treating as pure`,
    notes: [
      { message: "add an effect-map entry in hewg.config.json, or annotate the callee" },
    ],
    docs: info.docsUrl,
  }
}
