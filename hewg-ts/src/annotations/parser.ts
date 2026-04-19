import type { JSDocTag, JSDocableNode, Node, SourceFile } from "ts-morph"
import { ts } from "ts-morph"
import { DIAGNOSTIC_REGISTRY, type DiagnosticCode } from "../diag/codes.ts"
import type { Diagnostic, Span, Suggestion } from "../diag/types.ts"
import { BUILTIN_EFFECTS, effectKindOf, isEffectName } from "./effect-vocab.ts"
import type {
  CapEffectKind,
  CapScope,
  CostField,
  EffectName,
  ParseOptions,
  ParseResult,
  ParsedAnnotation,
} from "./types.ts"

const KNOWN_TAG_NAMES = new Set([
  "hewg-module",
  "effects",
  "cap",
  "pre",
  "post",
  "cost",
])

const KNOWN_COST_KEYS = ["tokens", "ops", "net", "fs", "proc", "time"] as const

const SCOPE_KEYS_BY_KIND: Record<CapEffectKind, readonly string[]> = {
  net: ["host", "port", "path_prefix"],
  fs: ["prefix"],
  proc: ["cmd_allowlist"],
  time: [],
  rand: [],
  log: [],
}

type MutResult = { annotations: ParsedAnnotation[]; errors: Diagnostic[] }

export function parseAnnotations(
  node: JSDocableNode & Node,
  opts: ParseOptions = {},
): ParseResult {
  const sf = node.getSourceFile()
  const out: MutResult = { annotations: [], errors: [] }
  for (const jsdoc of node.getJsDocs()) {
    for (const tag of jsdoc.getTags()) {
      try {
        dispatchTag(tag, sf, opts, out)
      } catch (e) {
        const span = tagFullSpan(sf, tag)
        const msg = e instanceof Error ? e.message : String(e)
        out.errors.push(makeDiag("E0201", span, `malformed annotation tag: ${msg}`))
      }
    }
  }
  return out
}

function dispatchTag(
  tag: JSDocTag,
  sf: SourceFile,
  opts: ParseOptions,
  out: MutResult,
): void {
  const name = tag.getTagName()
  if (!KNOWN_TAG_NAMES.has(name)) {
    if (name.startsWith("hewg-")) {
      handleUnknownHewgTag(tag, sf, out)
    }
    return
  }
  const ext = extractTagBody(sf, tag)
  switch (name) {
    case "hewg-module":
      parseHewgModule(ext, out)
      return
    case "effects":
      parseEffects(ext, opts, out)
      return
    case "cap":
      parseCap(ext, opts, out)
      return
    case "pre":
    case "post":
      parsePrePost(name, ext, out)
      return
    case "cost":
      parseCost(ext, out)
      return
  }
}

type TagExtract = {
  body: string
  bodyOffset: number
  tagStart: number
  tagSpan: Span
  sf: SourceFile
  tagName: string
}

function extractTagBody(sf: SourceFile, tag: JSDocTag): TagExtract {
  const full = sf.getFullText()
  const tagStart = tag.getStart()
  const nl = full.indexOf("\n", tagStart)
  const lineEnd = nl === -1 ? full.length : nl
  const raw = full.slice(tagStart, lineEnd)
  const head = /^@([-a-zA-Z][-a-zA-Z0-9_]*)/.exec(raw)
  const tagName = head ? head[1]! : tag.getTagName()
  let bodyOffset = tagStart + (head ? head[0].length : 0)
  while (bodyOffset < lineEnd) {
    const ch = full[bodyOffset]
    if (ch !== " " && ch !== "\t") break
    bodyOffset++
  }
  let bodyEnd = lineEnd
  while (bodyEnd > bodyOffset) {
    const ch = full[bodyEnd - 1]
    if (ch !== " " && ch !== "\t" && ch !== "\r") break
    bodyEnd--
  }
  const body = full.slice(bodyOffset, bodyEnd)
  const tagSpan = offsetToSpan(sf, tagStart, lineEnd - tagStart)
  return { body, bodyOffset, tagStart, tagSpan, sf, tagName }
}

function tagFullSpan(sf: SourceFile, tag: JSDocTag): Span {
  const full = sf.getFullText()
  const start = tag.getStart()
  const nl = full.indexOf("\n", start)
  const end = nl === -1 ? full.length : nl
  return offsetToSpan(sf, start, Math.max(1, end - start))
}

function offsetToSpan(sf: SourceFile, offset: number, len: number): Span {
  const { line, column } = sf.getLineAndColumnAtPos(offset)
  return { file: sf.getFilePath(), line, col: column, len }
}

function handleUnknownHewgTag(
  tag: JSDocTag,
  sf: SourceFile,
  out: MutResult,
): void {
  const name = tag.getTagName()
  const full = sf.getFullText()
  const tagStart = tag.getStart()
  const nl = full.indexOf("\n", tagStart)
  const lineEnd = nl === -1 ? full.length : nl
  const nameLen = 1 + name.length
  const nameSpan = offsetToSpan(sf, tagStart, nameLen)
  // Suggestion: remove the whole tag line including its leading ` * ` prefix
  let lineStart = tagStart
  while (lineStart > 0 && full[lineStart - 1] !== "\n") lineStart--
  const removeLen = lineEnd - lineStart + (nl === -1 ? 0 : 1)
  const removeSpan = offsetToSpan(sf, lineStart, removeLen)
  out.errors.push(
    makeDiag("W0002", nameSpan, `unknown tag \`@${name}\`; will be ignored`, [
      {
        kind: "remove-annotation",
        rationale: "remove the unknown tag",
        at: removeSpan,
        insert: "",
      },
    ]),
  )
}

function parseHewgModule(ext: TagExtract, out: MutResult): void {
  const body = ext.body
  if (body.length === 0) {
    out.errors.push(
      makeDiag("E0201", ext.tagSpan, "malformed @hewg-module tag: missing path"),
    )
    return
  }
  if (!/^[A-Za-z_][A-Za-z0-9_/.\-]*$/.test(body)) {
    const span = offsetToSpan(ext.sf, ext.bodyOffset, body.length)
    out.errors.push(
      makeDiag("E0201", span, `malformed @hewg-module tag: invalid module path \`${body}\``),
    )
    return
  }
  out.annotations.push({
    kind: "hewg-module",
    path: body,
    span: ext.tagSpan,
  })
}

function parseEffects(
  ext: TagExtract,
  opts: ParseOptions,
  out: MutResult,
): void {
  const body = ext.body
  if (body.length === 0) {
    out.errors.push(
      makeDiag("E0201", ext.tagSpan, "malformed @effects tag: missing effect list"),
    )
    return
  }
  const parts = body.split(",")
  const effects: EffectName[] = []
  const effectSpans: Span[] = []
  let cursor = ext.bodyOffset
  let bad = false
  for (const raw of parts) {
    const leading = raw.length - raw.trimStart().length
    const trimmed = raw.trim()
    const startOffset = cursor + leading
    cursor += raw.length + 1
    if (trimmed.length === 0) {
      out.errors.push(
        makeDiag(
          "E0201",
          offsetToSpan(ext.sf, startOffset, Math.max(1, raw.length)),
          "malformed @effects tag: empty effect name",
        ),
      )
      bad = true
      continue
    }
    if (/\s/.test(trimmed)) {
      const span = offsetToSpan(ext.sf, startOffset, trimmed.length)
      const suggestion = trimmed.split(/\s+/).join(", ")
      out.errors.push(
        makeDiag(
          "E0201",
          span,
          "malformed @effects tag: expected comma-separated effect names",
          [
            {
              kind: "fix-syntax",
              rationale: "separate effect names with commas",
              at: span,
              insert: suggestion,
            },
          ],
        ),
      )
      bad = true
      continue
    }
    if (!isEffectName(trimmed, opts.extraEffects)) {
      const span = offsetToSpan(ext.sf, startOffset, trimmed.length)
      const hint = closestWord(trimmed, BUILTIN_EFFECTS)
      const suggest: Suggestion[] = hint
        ? [
            {
              kind: "fix-syntax",
              rationale: `did you mean \`${hint}\`?`,
              at: span,
              insert: hint,
            },
          ]
        : []
      out.errors.push(
        makeDiag(
          "E0201",
          span,
          `malformed @effects tag: unknown effect \`${trimmed}\``,
          suggest,
        ),
      )
      bad = true
      continue
    }
    effects.push(trimmed)
    effectSpans.push(offsetToSpan(ext.sf, startOffset, trimmed.length))
  }
  if (!bad) {
    out.annotations.push({
      kind: "effects",
      effects,
      effectSpans,
      span: ext.tagSpan,
    })
  }
}

function parseCap(
  ext: TagExtract,
  opts: ParseOptions,
  out: MutResult,
): void {
  const body = ext.body
  if (body.length === 0) {
    out.errors.push(
      makeDiag("E0201", ext.tagSpan, "malformed @cap tag: missing parameter and kind"),
    )
    return
  }
  const tokens = tokenizeHead(body, ext.bodyOffset)
  if (tokens.length < 2) {
    out.errors.push(
      makeDiag("E0201", ext.tagSpan, "malformed @cap tag: expected `<param> <kind> [scope...]`"),
    )
    return
  }
  const [paramTok, effectTok, ...rest] = tokens
  const param = paramTok!.text
  const effect = effectTok!.text
  const paramSpan = offsetToSpan(ext.sf, paramTok!.offset, param.length)

  if (opts.paramNames !== undefined) {
    if (!opts.paramNames.includes(param)) {
      const hint = closestWord(param, opts.paramNames)
      const suggest: Suggestion[] = hint
        ? [
            {
              kind: "rename-arg",
              rationale: "rename the @cap parameter to match the function signature",
              at: paramSpan,
              insert: hint,
            },
          ]
        : []
      out.errors.push(
        makeDiag(
          "E0202",
          paramSpan,
          `@cap references parameter \`${param}\` which does not exist on this function`,
          suggest,
        ),
      )
      return
    }
  }

  if (!isEffectName(effect, opts.extraEffects)) {
    const span = offsetToSpan(ext.sf, effectTok!.offset, effect.length)
    const hint = closestWord(effect, BUILTIN_EFFECTS)
    const suggest: Suggestion[] = hint
      ? [
          {
            kind: "fix-syntax",
            rationale: `did you mean \`${hint}\`?`,
            at: span,
            insert: hint,
          },
        ]
      : []
    out.errors.push(
      makeDiag("E0201", span, `malformed @cap tag: unknown effect kind \`${effect}\``, suggest),
    )
    return
  }

  const kind = effectKindOf(effect)
  if (kind === undefined) {
    const span = offsetToSpan(ext.sf, effectTok!.offset, effect.length)
    out.errors.push(
      makeDiag("E0201", span, `malformed @cap tag: unknown effect kind \`${effect}\``),
    )
    return
  }

  const kvTokens: KvToken[] = []
  let badScope = false
  for (const tok of rest) {
    const kv = parseKvToken(ext.sf, tok, out)
    if (kv === undefined) {
      badScope = true
    } else {
      kvTokens.push(kv)
    }
  }
  if (badScope) return

  const allowed = new Set(SCOPE_KEYS_BY_KIND[kind])
  const scope = buildScope(kind)
  for (const kv of kvTokens) {
    if (!allowed.has(kv.key)) {
      const span = offsetToSpan(ext.sf, kv.keyOffset, kv.key.length)
      out.errors.push(
        makeDiag(
          "E0201",
          span,
          `malformed @cap tag: unknown scope key \`${kv.key}\` for kind \`${effect}\``,
        ),
      )
      return
    }
    applyScope(scope, kind, kv, ext.sf, out)
  }

  out.annotations.push({
    kind: "cap",
    param,
    effect,
    effectKind: kind,
    scope,
    span: ext.tagSpan,
    paramSpan,
  })
}

function buildScope(kind: CapEffectKind): CapScope {
  if (kind === "net") return { kind: "net" }
  if (kind === "fs") return { kind: "fs" }
  if (kind === "proc") return { kind: "proc" }
  if (kind === "time") return { kind: "time" }
  if (kind === "rand") return { kind: "rand" }
  return { kind: "log" }
}

function applyScope(
  scope: CapScope,
  kind: CapEffectKind,
  kv: KvToken,
  sf: SourceFile,
  out: MutResult,
): void {
  if (kind === "net" && scope.kind === "net") {
    if (kv.key === "host") scope.host = kv.value
    else if (kv.key === "port") {
      const n = Number.parseInt(kv.value, 10)
      if (!Number.isFinite(n) || !/^\d+$/.test(kv.value)) {
        const span = offsetToSpan(sf, kv.valueOffset, kv.valueLen)
        out.errors.push(
          makeDiag("E0201", span, `malformed @cap tag: port must be a positive integer`),
        )
        return
      }
      scope.port = n
    } else if (kv.key === "path_prefix") scope.pathPrefix = kv.value
    return
  }
  if (kind === "fs" && scope.kind === "fs") {
    if (kv.key === "prefix") scope.prefix = kv.value
    return
  }
  if (kind === "proc" && scope.kind === "proc") {
    if (kv.key === "cmd_allowlist") {
      const prev = scope.cmdAllowlist ?? []
      scope.cmdAllowlist = [...prev, kv.value]
    }
    return
  }
}

function parsePrePost(
  kind: "pre" | "post",
  ext: TagExtract,
  out: MutResult,
): void {
  const body = ext.body
  if (body.length === 0) {
    out.errors.push(
      makeDiag("E0501", ext.tagSpan, `malformed @${kind} expression: empty body`),
    )
    return
  }
  const wrapped = `(${body});`
  const tempSf = ts.createSourceFile(
    `<${kind}>.ts`,
    wrapped,
    ts.ScriptTarget.Latest,
    true,
  )
  const diags = (tempSf as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? []
  if (diags.length > 0) {
    const first = diags[0]!
    const firstLen = first.length ?? 1
    const adjStart = Math.max(0, (first.start ?? 0) - 1)
    const exprSpan = offsetToSpan(
      ext.sf,
      ext.bodyOffset + Math.min(adjStart, body.length),
      Math.max(1, Math.min(firstLen, body.length - adjStart)),
    )
    out.errors.push(
      makeDiag(
        "E0501",
        exprSpan,
        `malformed @${kind} expression: ${flattenMessage(first.messageText)}`,
      ),
    )
    return
  }
  const exprSpan = offsetToSpan(ext.sf, ext.bodyOffset, body.length)
  if (kind === "pre") {
    out.annotations.push({
      kind: "pre",
      expression: body,
      span: ext.tagSpan,
      exprSpan,
    })
  } else {
    out.annotations.push({
      kind: "post",
      expression: body,
      span: ext.tagSpan,
      exprSpan,
    })
  }
}

function flattenMessage(m: string | ts.DiagnosticMessageChain): string {
  if (typeof m === "string") return m
  return m.messageText
}

function parseCost(ext: TagExtract, out: MutResult): void {
  const body = ext.body
  if (body.length === 0) {
    out.errors.push(
      makeDiag("E0201", ext.tagSpan, "malformed @cost tag: missing fields"),
    )
    return
  }
  const fields: CostField[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const token = m[0]
    const tokStart = ext.bodyOffset + m.index
    const eqIdx = token.search(/<=|=/)
    if (eqIdx < 0) {
      out.errors.push(
        makeDiag(
          "E0201",
          offsetToSpan(ext.sf, tokStart, token.length),
          `malformed @cost tag: expected \`key=value\`, got \`${token}\``,
        ),
      )
      continue
    }
    const opIsLe = token.slice(eqIdx, eqIdx + 2) === "<="
    const opLen = opIsLe ? 2 : 1
    const key = token.slice(0, eqIdx)
    const value = token.slice(eqIdx + opLen)
    const keyOffset = tokStart
    const valueOffset = tokStart + eqIdx + opLen
    const keySpan = offsetToSpan(ext.sf, keyOffset, key.length)

    if (!KNOWN_COST_KEYS.includes(key as (typeof KNOWN_COST_KEYS)[number])) {
      const hint = closestWord(key, KNOWN_COST_KEYS)
      const suggest: Suggestion[] = hint
        ? [
            {
              kind: "fix-cost-field",
              rationale: `did you mean \`${hint}\`?`,
              at: keySpan,
              insert: hint,
            },
          ]
        : []
      out.errors.push(
        makeDiag(
          "W0001",
          keySpan,
          `unknown @cost field \`${key}\`; expected one of ${KNOWN_COST_KEYS.join(", ")}`,
          suggest,
        ),
      )
      fields.push({ key, raw: token, known: false })
      continue
    }

    const valSpan = offsetToSpan(ext.sf, valueOffset, Math.max(1, value.length))
    if (key === "tokens") {
      if (opIsLe) {
        out.errors.push(
          makeDiag("E0501", offsetToSpan(ext.sf, tokStart, token.length), `malformed @cost tag: \`tokens\` uses \`=\`, not \`<=\``),
        )
        continue
      }
      const n = intOrUndef(value)
      if (n === undefined) {
        out.errors.push(
          makeDiag("E0501", valSpan, `malformed @cost tag: \`tokens\` requires a non-negative integer`),
        )
        continue
      }
      fields.push({ key: "tokens", value: n, raw: token, known: true })
      continue
    }
    if (key === "ops") {
      if (opIsLe) {
        out.errors.push(
          makeDiag("E0501", offsetToSpan(ext.sf, tokStart, token.length), `malformed @cost tag: \`ops\` uses \`=\`, not \`<=\``),
        )
        continue
      }
      const approx = value.startsWith("~")
      const num = approx ? value.slice(1) : value
      const n = intOrUndef(num)
      if (n === undefined) {
        out.errors.push(
          makeDiag("E0501", valSpan, `malformed @cost tag: \`ops\` requires \`<int>\` or \`~<int>\``),
        )
        continue
      }
      fields.push({ key: "ops", value: n, approx, raw: token, known: true })
      continue
    }
    if (key === "net" || key === "fs" || key === "proc") {
      if (!opIsLe) {
        out.errors.push(
          makeDiag("E0501", offsetToSpan(ext.sf, tokStart, token.length), `malformed @cost tag: \`${key}\` uses \`<=\`, not \`=\``),
        )
        continue
      }
      const n = intOrUndef(value)
      if (n === undefined) {
        out.errors.push(
          makeDiag("E0501", valSpan, `malformed @cost tag: \`${key}\` requires a non-negative integer`),
        )
        continue
      }
      fields.push({ key, bound: "<=", value: n, raw: token, known: true })
      continue
    }
    if (key === "time") {
      if (!opIsLe) {
        out.errors.push(
          makeDiag("E0501", offsetToSpan(ext.sf, tokStart, token.length), `malformed @cost tag: \`time\` uses \`<=\`, not \`=\``),
        )
        continue
      }
      const dur = parseDuration(value)
      if (dur === undefined) {
        out.errors.push(
          makeDiag("E0501", valSpan, `malformed @cost tag: \`time\` requires a duration like \`5s\`, \`250ms\`, \`1m\``),
        )
        continue
      }
      fields.push({ key: "time", bound: "<=", durationMs: dur, raw: token, known: true })
      continue
    }
  }
  out.annotations.push({ kind: "cost", fields, span: ext.tagSpan })
}

function intOrUndef(s: string): number | undefined {
  if (!/^\d+$/.test(s)) return undefined
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n)) return undefined
  return n
}

function parseDuration(s: string): number | undefined {
  const m = /^(\d+)(ms|s|m|h)$/.exec(s)
  if (!m) return undefined
  const n = Number.parseInt(m[1]!, 10)
  switch (m[2]) {
    case "ms": return n
    case "s": return n * 1000
    case "m": return n * 60_000
    case "h": return n * 3_600_000
  }
  return undefined
}

type HeadToken = { text: string; offset: number }

function tokenizeHead(body: string, bodyOffset: number): HeadToken[] {
  const tokens: HeadToken[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    tokens.push({ text: m[0], offset: bodyOffset + m.index })
    if (tokens.length >= 2) {
      // leave the rest to the KV tokenizer
      const restStart = m.index + m[0].length
      pushKvTokens(body.slice(restStart), bodyOffset + restStart, tokens)
      return tokens
    }
  }
  return tokens
}

function pushKvTokens(rest: string, baseOffset: number, out: HeadToken[]): void {
  let i = 0
  while (i < rest.length) {
    while (i < rest.length && /\s/.test(rest[i]!)) i++
    if (i >= rest.length) break
    const start = i
    let inQuote = false
    while (i < rest.length) {
      const ch = rest[i]!
      if (ch === "\"") inQuote = !inQuote
      else if (!inQuote && /\s/.test(ch)) break
      i++
    }
    out.push({ text: rest.slice(start, i), offset: baseOffset + start })
  }
}

type KvToken = {
  key: string
  value: string
  keyOffset: number
  valueOffset: number
  valueLen: number
}

function parseKvToken(
  sf: SourceFile,
  tok: HeadToken,
  out: MutResult,
): KvToken | undefined {
  const eqIdx = tok.text.indexOf("=")
  if (eqIdx <= 0) {
    out.errors.push(
      makeDiag(
        "E0201",
        offsetToSpan(sf, tok.offset, Math.max(1, tok.text.length)),
        `malformed @cap tag: expected \`key=value\`, got \`${tok.text}\``,
      ),
    )
    return undefined
  }
  const key = tok.text.slice(0, eqIdx)
  const rawValue = tok.text.slice(eqIdx + 1)
  const valueOffset = tok.offset + eqIdx + 1
  if (rawValue.startsWith("\"")) {
    // Single-pass unescape: decode \\ and \" atomically while walking forward,
    // and detect unterminated values (e.g. `"abc\"` where the final " is an
    // escape, not the closing delimiter).
    let i = 1
    let decoded = ""
    let terminated = false
    while (i < rawValue.length) {
      const ch = rawValue[i]!
      if (ch === "\\") {
        const next = rawValue[i + 1]
        if (next === "\\" || next === "\"") {
          decoded += next
          i += 2
          continue
        }
        decoded += ch
        i += 1
        continue
      }
      if (ch === "\"") {
        terminated = true
        i += 1
        break
      }
      decoded += ch
      i += 1
    }
    if (!terminated || i !== rawValue.length) {
      out.errors.push(
        makeDiag(
          "E0201",
          offsetToSpan(sf, valueOffset, Math.max(1, rawValue.length)),
          "malformed @cap tag: unterminated quoted value",
        ),
      )
      return undefined
    }
    return {
      key,
      value: decoded,
      keyOffset: tok.offset,
      valueOffset,
      valueLen: rawValue.length,
    }
  }
  return {
    key,
    value: rawValue,
    keyOffset: tok.offset,
    valueOffset,
    valueLen: rawValue.length,
  }
}

function closestWord(target: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined
  let bestDist = Number.POSITIVE_INFINITY
  for (const c of candidates) {
    const d = editDistance(target, c)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  const threshold = Math.max(1, Math.floor(target.length / 2))
  return bestDist <= threshold ? best : undefined
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
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost,
      )
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!
  }
  return prev[n]!
}

function makeDiag(
  code: DiagnosticCode,
  span: Span,
  message: string,
  suggest?: Suggestion[],
): Diagnostic {
  const info = DIAGNOSTIC_REGISTRY[code]
  const d: Diagnostic = {
    code,
    severity: info.severity,
    file: span.file,
    line: span.line,
    col: span.col,
    len: span.len,
    message,
    docs: info.docsUrl,
  }
  if (suggest !== undefined && suggest.length > 0) d.suggest = suggest
  return d
}

// Re-export for convenience.
export { BUILTIN_EFFECTS, isEffectName } from "./effect-vocab.ts"
export type {
  CapEffectKind,
  CapScope,
  CostField,
  EffectName,
  ParseOptions,
  ParseResult,
  ParsedAnnotation,
} from "./types.ts"
