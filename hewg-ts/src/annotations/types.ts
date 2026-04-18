import type { Diagnostic, Span } from "../diag/types.ts"

export type EffectName = string

export type CapEffectKind = "net" | "fs" | "proc" | "time" | "rand" | "log"

export type CapScope =
  | { kind: "net"; host?: string; port?: number; pathPrefix?: string }
  | { kind: "fs"; prefix?: string }
  | { kind: "proc"; cmdAllowlist?: readonly string[] }
  | { kind: "time" }
  | { kind: "rand" }
  | { kind: "log" }

export type CostField =
  | { key: "tokens"; value: number; raw: string; known: true }
  | { key: "ops"; value: number; approx: boolean; raw: string; known: true }
  | { key: "net" | "fs" | "proc"; bound: "<="; value: number; raw: string; known: true }
  | { key: "time"; bound: "<="; durationMs: number; raw: string; known: true }
  | { key: string; raw: string; known: false }

export type ParsedAnnotation =
  | { kind: "hewg-module"; path: string; span: Span }
  | { kind: "effects"; effects: readonly EffectName[]; span: Span }
  | {
      kind: "cap"
      param: string
      effect: EffectName
      effectKind: CapEffectKind
      scope: CapScope
      span: Span
      paramSpan: Span
    }
  | { kind: "pre"; expression: string; span: Span; exprSpan: Span }
  | { kind: "post"; expression: string; span: Span; exprSpan: Span }
  | { kind: "cost"; fields: readonly CostField[]; span: Span }

export type ParseOptions = {
  extraEffects?: ReadonlySet<string>
  paramNames?: readonly string[]
}

export type ParseResult = {
  annotations: ParsedAnnotation[]
  errors: Diagnostic[]
}
