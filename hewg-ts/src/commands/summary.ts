import { dirname, relative } from "node:path"
import type {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  InterfaceDeclaration,
  MethodDeclaration,
  SourceFile,
  TypeAliasDeclaration,
} from "ts-morph"
import { Node, SyntaxKind } from "ts-morph"
import { parseAnnotations } from "../annotations/parser.ts"
import type { CostField, ParsedAnnotation } from "../annotations/types.ts"
import type { ExportHit } from "../contract/lookup.ts"
import { buildSymbolIndex, closest } from "../contract/lookup.ts"
import { DIAGNOSTIC_REGISTRY } from "../diag/codes.ts"
import { renderJson } from "../diag/render.ts"
import type { Diagnostic, Suggestion } from "../diag/types.ts"
import { loadProject } from "../project.ts"

export type RunSummaryOptions = {
  project?: string
  cwd?: string
}

export type RunSummaryResult = {
  exitCode: 0 | 1 | 2
  stdout: string
  stderr: string
}

type FnLike = FunctionDeclaration | ArrowFunction | FunctionExpression | MethodDeclaration

const LABEL_WIDTH = 9

/**
 * @hewg-module commands/summary
 * @effects fs.read
 */
export function runSummary(moduleName: string, opts: RunSummaryOptions = {}): RunSummaryResult {
  const loaded = loadProject({ cwd: opts.cwd, tsconfigPath: opts.project })
  if (!loaded.ok) {
    return { exitCode: 1, stdout: "", stderr: renderJson([loaded.error]) }
  }

  const index = buildSymbolIndex(loaded.project)
  const sf = index.byModule.get(moduleName)
  if (sf === undefined) {
    const diag = makeNotFoundDiag(moduleName, [...index.byModule.keys()])
    return { exitCode: 1, stdout: "", stderr: renderJson([diag]) }
  }

  const projectRoot = dirname(loaded.tsconfigPath)
  const relFile = relative(projectRoot, sf.getFilePath())
  const fnHits = (index.byFile.get(sf.getFilePath()) ?? []).filter(
    (h) => h.moduleName === moduleName,
  )
  const parsedByHit = fnHits.map((h) => parseAnnotations(h.decl).annotations)

  const unionEffectList = collectUnionEffects(parsedByHit)
  const typeLines = renderTypeLines(sf)

  const lines: string[] = []
  lines.push(`module ${moduleName} (${relFile})`)
  if (unionEffectList.length > 0) {
    lines.push(`  effects: ${unionEffectList.join(", ")}`)
  }

  if (fnHits.length > 0 || typeLines.length > 0) {
    lines.push("")
    lines.push("exports:")
    for (let i = 0; i < fnHits.length; i++) {
      const hit = fnHits[i]!
      const ann = parsedByHit[i]!
      lines.push(...renderExportFn(hit, ann, unionEffectList))
    }
    for (const tl of typeLines) lines.push(tl)
  }

  return { exitCode: 0, stdout: lines.join("\n"), stderr: "" }
}

function renderExportFn(
  hit: ExportHit,
  annotations: readonly ParsedAnnotation[],
  moduleEffects: readonly string[],
): string[] {
  const fn = hit.fn
  const paramNames = fn.getParameters().map((p) => p.getName())
  const ret = renderReturn(fn)
  const header = `  ${hit.displayName}(${paramNames.join(", ")}) => ${ret}`
  const out: string[] = [header]

  const effects = annotations.filter((a) => a.kind === "effects").flatMap((a) => a.effects)
  if (effects.length > 0 && !sameEffects(effects, moduleEffects)) {
    out.push(indentedLine("effects:", effects.join(", ")))
  }

  const caps = renderCapsCompact(annotations)
  if (caps !== "") out.push(indentedLine("caps:", caps))

  const pre = annotations.filter((a) => a.kind === "pre").map((a) => a.expression)
  if (pre.length > 0) out.push(indentedLine("pre:", pre.join(" && ")))

  const post = annotations.filter((a) => a.kind === "post").map((a) => a.expression)
  if (post.length > 0) out.push(indentedLine("post:", post.join(" && ")))

  const cost = renderCostCompact(annotations)
  if (cost !== "") out.push(indentedLine("cost:", cost))

  if (annotations.some((a) => a.kind === "idempotent")) {
    out.push(indentedLine("idempotent:", "yes"))
  }

  const layerAnn = annotations.find((a) => a.kind === "layer")
  if (layerAnn !== undefined && layerAnn.kind === "layer") {
    out.push(indentedLine("layer:", layerAnn.tier))
  }

  return out
}

function indentedLine(label: string, value: string): string {
  return `      ${label.padEnd(LABEL_WIDTH, " ")}${value}`
}

function renderReturn(fn: FnLike): string {
  const tnode = fn.getReturnTypeNode()
  if (tnode !== undefined) return tnode.getText()
  return fn.getReturnType().getText(fn)
}

function renderCapsCompact(annotations: readonly ParsedAnnotation[]): string {
  const parts: string[] = []
  for (const a of annotations) {
    if (a.kind !== "cap") continue
    const s = a.scope
    if (s.kind === "net") {
      const host = s.host ?? ""
      const port = s.port !== undefined ? `:${s.port}` : ""
      parts.push(host.length > 0 ? `${a.param}@${host}${port}` : a.param)
    } else if (s.kind === "fs") {
      parts.push(s.prefix !== undefined ? `${a.param}@${s.prefix}` : a.param)
    } else {
      parts.push(a.param)
    }
  }
  return parts.join(", ")
}

function renderCostCompact(annotations: readonly ParsedAnnotation[]): string {
  for (const a of annotations) {
    if (a.kind !== "cost") continue
    const parts: string[] = []
    for (const f of a.fields) parts.push(renderCostField(f))
    return parts.join(", ")
  }
  return ""
}

function renderCostField(f: CostField): string {
  if (!f.known) return f.raw
  switch (f.key) {
    case "tokens":
      return `${f.value} tok`
    case "ops":
      return `${f.approx ? "~" : ""}${f.value} ops`
    case "net":
    case "fs":
    case "proc":
      return `<=${f.value} ${f.key}`
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

function sameEffects(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function collectUnionEffects(parsed: readonly (readonly ParsedAnnotation[])[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const ann of parsed) {
    for (const a of ann) {
      if (a.kind !== "effects") continue
      for (const e of a.effects) {
        if (seen.has(e)) continue
        seen.add(e)
        out.push(e)
      }
    }
  }
  return out
}

type ExportedTypeDecl =
  | { kind: "interface"; decl: InterfaceDeclaration }
  | { kind: "alias"; decl: TypeAliasDeclaration }

function enumerateExportedTypes(sf: SourceFile): ExportedTypeDecl[] {
  const out: ExportedTypeDecl[] = []
  for (const ifc of sf.getInterfaces()) {
    if (ifc.isExported()) out.push({ kind: "interface", decl: ifc })
  }
  for (const ta of sf.getTypeAliases()) {
    if (ta.isExported()) out.push({ kind: "alias", decl: ta })
  }
  out.sort((a, b) => a.decl.getStart() - b.decl.getStart())
  return out
}

function renderTypeLines(sf: SourceFile): string[] {
  const entries = enumerateExportedTypes(sf)
  const rows: { name: string; detail: string }[] = []
  for (const e of entries) {
    if (e.kind === "interface") {
      const fields = e.decl.getProperties().length
      rows.push({ name: e.decl.getName(), detail: `${fields} fields` })
    } else {
      const name = e.decl.getName()
      const typeNode = e.decl.getTypeNode()
      if (typeNode !== undefined && typeNode.getKind() === SyntaxKind.UnionType) {
        const arms = typeNode.asKindOrThrow(SyntaxKind.UnionType).getTypeNodes()
        const names = arms.map(extractVariantName)
        const shown = names.slice(0, 3).join(", ")
        const suffix = names.length > 3 ? ", ..." : ""
        rows.push({ name, detail: `${arms.length} variants (${shown}${suffix})` })
      } else if (typeNode !== undefined && typeNode.getKind() === SyntaxKind.TypeLiteral) {
        const tl = typeNode.asKindOrThrow(SyntaxKind.TypeLiteral)
        rows.push({ name, detail: `${tl.getProperties().length} fields` })
      } else {
        rows.push({ name, detail: "" })
      }
    }
  }
  if (rows.length === 0) return []
  const nameWidth = Math.max(...rows.map((r) => r.name.length))
  return rows.map((r) => {
    const pad = " ".repeat(nameWidth - r.name.length)
    if (r.detail === "") return `  type ${r.name}`
    return `  type ${r.name}${pad}  \u2014 ${r.detail}`
  })
}

function extractVariantName(node: Node): string {
  if (node.getKind() === SyntaxKind.TypeLiteral) {
    const tl = node.asKindOrThrow(SyntaxKind.TypeLiteral)
    for (const key of ["kind", "tag", "type"]) {
      const prop = tl.getProperty(key)
      if (prop !== undefined && Node.isPropertySignature(prop)) {
        const tn = prop.getTypeNode()
        if (tn !== undefined && tn.getKind() === SyntaxKind.LiteralType) {
          const lit = tn.asKindOrThrow(SyntaxKind.LiteralType).getLiteral()
          if (Node.isStringLiteral(lit)) return lit.getLiteralText()
        }
      }
    }
  }
  return node.getText().trim()
}

function makeNotFoundDiag(query: string, modules: readonly string[]): Diagnostic {
  const info = DIAGNOSTIC_REGISTRY.E0003
  const nearest = closest(query, modules)
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
    message: `module \`${query}\` not found`,
    docs: info.docsUrl,
  }
  if (suggest.length > 0) d.suggest = suggest
  return d
}
