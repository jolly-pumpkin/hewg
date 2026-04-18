import type {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  JSDocableNode,
  MethodDeclaration,
  Node,
  Project,
  SourceFile,
  VariableDeclaration,
} from "ts-morph"
import { parseAnnotations } from "../annotations/parser.ts"

export type ExportedFunctionLike = FunctionDeclaration | ArrowFunction | FunctionExpression | MethodDeclaration

export type ExportHit = {
  file: SourceFile
  decl: Node & JSDocableNode
  fn: ExportedFunctionLike
  displayName: string
  moduleName?: string
}

export type SymbolIndex = {
  hits: ExportHit[]
  byModule: Map<string, SourceFile>
  // moduleName → { displayName → hit[] }
  byModuleAndName: Map<string, Map<string, ExportHit[]>>
  // normalized file path → hit[]
  byFile: Map<string, ExportHit[]>
  // displayName → hit[]
  byName: Map<string, ExportHit[]>
}

export type LookupResult =
  | { kind: "found"; hit: ExportHit }
  | { kind: "not-found"; query: string; nearest: string[] }
  | { kind: "ambiguous"; query: string; candidates: ExportHit[] }

export function buildSymbolIndex(project: Project): SymbolIndex {
  const hits: ExportHit[] = []
  const byModule = new Map<string, SourceFile>()

  for (const sf of project.getSourceFiles()) {
    if (sf.isDeclarationFile()) continue
    const moduleName = detectModule(sf)
    if (moduleName !== undefined && !byModule.has(moduleName)) {
      byModule.set(moduleName, sf)
    }
    collectExports(sf, moduleName, hits)
  }

  const byModuleAndName = new Map<string, Map<string, ExportHit[]>>()
  const byFile = new Map<string, ExportHit[]>()
  const byName = new Map<string, ExportHit[]>()

  for (const hit of hits) {
    if (hit.moduleName !== undefined) {
      let inner = byModuleAndName.get(hit.moduleName)
      if (inner === undefined) {
        inner = new Map()
        byModuleAndName.set(hit.moduleName, inner)
      }
      pushMulti(inner, hit.displayName, hit)
    }
    const key = hit.file.getFilePath()
    pushMulti(byFile, key, hit)
    pushMulti(byName, hit.displayName, hit)
  }

  return { hits, byModule, byModuleAndName, byFile, byName }
}

export function lookupSymbol(idx: SymbolIndex, query: string): LookupResult {
  const modMatch = query.match(/^([^:]+)::(.+)$/)
  if (modMatch !== undefined && modMatch !== null) {
    const mod = modMatch[1]!
    const name = modMatch[2]!
    const inner = idx.byModuleAndName.get(mod)
    if (inner === undefined) {
      const nearest = closest(mod, [...idx.byModule.keys()]).map(
        (m) => `${m}::${name}`,
      )
      return { kind: "not-found", query, nearest }
    }
    const hits = inner.get(name) ?? []
    if (hits.length === 0) {
      const allNames = [...inner.keys()]
      const nearest = closest(name, allNames).map((n) => `${mod}::${n}`)
      return { kind: "not-found", query, nearest }
    }
    if (hits.length > 1) return { kind: "ambiguous", query, candidates: hits }
    return { kind: "found", hit: hits[0]! }
  }

  const fileMatch = query.match(/^(.+\.ts):([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)$/)
  if (fileMatch !== undefined && fileMatch !== null) {
    const filePart = fileMatch[1]!
    const name = fileMatch[2]!
    const files = [...idx.byFile.keys()].filter((p) => p.endsWith(filePart) || p.endsWith("/" + filePart))
    if (files.length === 0) {
      return { kind: "not-found", query, nearest: [] }
    }
    if (files.length > 1) {
      const candidates = files.flatMap((f) => idx.byFile.get(f) ?? []).filter((h) => h.displayName === name)
      if (candidates.length === 0) return { kind: "not-found", query, nearest: [] }
      if (candidates.length > 1) return { kind: "ambiguous", query, candidates }
      return { kind: "found", hit: candidates[0]! }
    }
    const all = idx.byFile.get(files[0]!) ?? []
    const matches = all.filter((h) => h.displayName === name)
    if (matches.length === 0) {
      const nearest = closest(name, all.map((h) => h.displayName))
      return { kind: "not-found", query, nearest }
    }
    if (matches.length > 1) return { kind: "ambiguous", query, candidates: matches }
    return { kind: "found", hit: matches[0]! }
  }

  const matches = idx.byName.get(query) ?? []
  if (matches.length === 0) {
    const nearest = closest(query, [...idx.byName.keys()])
    return { kind: "not-found", query, nearest }
  }
  if (matches.length > 1) return { kind: "ambiguous", query, candidates: matches }
  return { kind: "found", hit: matches[0]! }
}

function collectExports(
  sf: SourceFile,
  moduleName: string | undefined,
  out: ExportHit[],
): void {
  for (const fn of sf.getFunctions()) {
    if (!fn.isExported()) continue
    const name = fn.getName()
    if (name === undefined) continue
    out.push({
      file: sf,
      decl: fn,
      fn,
      displayName: name,
      moduleName,
    })
  }

  for (const cls of sf.getClasses()) {
    if (!cls.isExported()) continue
    const className = cls.getName()
    if (className === undefined) continue
    for (const method of cls.getMethods()) {
      const mname = method.getName()
      if (mname === undefined) continue
      out.push({
        file: sf,
        decl: method,
        fn: method,
        displayName: `${className}.${mname}`,
        moduleName,
      })
    }
  }

  for (const varStmt of sf.getVariableStatements()) {
    if (!varStmt.isExported()) continue
    for (const decl of varStmt.getDeclarations()) {
      const fnLike = functionLikeOf(decl)
      if (fnLike === undefined) continue
      out.push({
        file: sf,
        decl: varStmt, // JSDoc lives on the statement
        fn: fnLike,
        displayName: decl.getName(),
        moduleName,
      })
    }
  }
}

function functionLikeOf(decl: VariableDeclaration): ArrowFunction | FunctionExpression | undefined {
  const init = decl.getInitializer()
  if (init === undefined) return undefined
  const kind = init.getKindName()
  if (kind === "ArrowFunction") return init as ArrowFunction
  if (kind === "FunctionExpression") return init as FunctionExpression
  return undefined
}

function detectModule(sf: SourceFile): string | undefined {
  const candidates: (Node & JSDocableNode)[] = []
  for (const fn of sf.getFunctions()) candidates.push(fn)
  for (const cls of sf.getClasses()) candidates.push(cls)
  for (const varStmt of sf.getVariableStatements()) candidates.push(varStmt)
  for (const ifc of sf.getInterfaces()) candidates.push(ifc)
  for (const ta of sf.getTypeAliases()) candidates.push(ta)

  for (const node of candidates) {
    const { annotations } = parseAnnotations(node)
    for (const a of annotations) {
      if (a.kind === "hewg-module") return a.path
    }
  }
  return undefined
}

function pushMulti<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key)
  if (arr === undefined) map.set(key, [value])
  else arr.push(value)
}

function closest(target: string, candidates: readonly string[]): string[] {
  const scored = candidates
    .map((c) => ({ c, d: editDistance(target, c) }))
    .sort((a, b) => a.d - b.d)
  const threshold = Math.max(2, Math.floor(target.length / 2))
  return scored.filter((s) => s.d <= threshold).slice(0, 3).map((s) => s.c)
}

function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const prev = new Array<number>(n + 1)
  const curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!
  }
  return prev[n]!
}
