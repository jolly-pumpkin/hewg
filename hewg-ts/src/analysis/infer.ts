// Effect inference pass.
//
// For every exported function that lacks an @effects annotation, walk its
// call graph via resolveCalleeEffects and compute the union of observed
// effects. Returns InferredAnnotation[] that can be rendered as diffs,
// JSON, or applied directly to source files.

import { relative } from "node:path"
import type { Project } from "ts-morph"
import { parseAnnotations } from "../annotations/parser.ts"
import type { EffectName } from "../annotations/types.ts"
import type { ExportHit, SymbolIndex } from "../contract/lookup.ts"
import { resolveCalleeEffects, type EffectPropOptions } from "./effect-prop.ts"

// ── Types ──────────────────────────────────────────────────────────────────

export type InferredAnnotation = {
  file: string
  line: number
  symbolName: string
  effects: EffectName[]
}

export type SkippedSymbol = {
  symbolName: string
  file: string
  reason: string
}

export type InferResult = {
  inferred: InferredAnnotation[]
  skipped: SkippedSymbol[]
}

// ── Core inference ─────────────────────────────────────────────────────────

/**
 * For every exported function missing @effects, infer the effect set
 * by walking its call graph.
 *
 * @hewg-module analysis/infer
 * @effects
 */
export function runInfer(
  project: Project,
  index: SymbolIndex,
  opts: EffectPropOptions,
  projectRoot: string,
): InferResult {
  const inferred: InferredAnnotation[] = []
  const skipped: SkippedSymbol[] = []

  for (const hit of index.hits) {
    const parsed = parseAnnotations(hit.decl)
    const hasEffects = parsed.annotations.some((a) => a.kind === "effects")
    const relFile = relative(projectRoot, hit.file.getFilePath())

    if (hasEffects) {
      skipped.push({
        symbolName: hit.displayName,
        file: relFile,
        reason: "already has @effects",
      })
      continue
    }

    const callees = resolveCalleeEffects(hit.fn, project, index, opts)
    const effectSet = new Set<EffectName>()
    for (const entry of callees) {
      for (const e of entry.effects) effectSet.add(e)
    }

    inferred.push({
      file: relFile,
      line: hit.decl.getStartLineNumber(),
      symbolName: hit.displayName,
      effects: [...effectSet].sort(),
    })
  }

  return { inferred, skipped }
}

// ── Formatters ─────────────────────────────────────────────────────────────

/**
 * Render inferred annotations as a unified diff showing JSDoc insertions.
 *
 * @effects
 */
export function formatInferDiff(result: InferResult): string {
  const lines: string[] = []

  for (const ann of result.inferred) {
    const tag = ann.effects.length > 0
      ? `@effects ${ann.effects.join(", ")}`
      : "@effects"

    lines.push(`--- a/${ann.file}`)
    lines.push(`+++ b/${ann.file}`)
    lines.push(`@@ -${ann.line},0 +${ann.line},1 @@`)
    lines.push(`+/** ${tag} */`)
  }

  return lines.join("\n") + (lines.length > 0 ? "\n" : "")
}

/**
 * Render inferred annotations as JSON.
 *
 * @effects
 */
export function formatInferJson(result: InferResult): string {
  const entries = result.inferred.map((ann) => ({
    file: ann.file,
    line: ann.line,
    symbol: ann.symbolName,
    effects: ann.effects,
    tag: ann.effects.length > 0
      ? `@effects ${ann.effects.join(", ")}`
      : "@effects",
  }))
  return JSON.stringify(entries, null, 2)
}

// ── Apply mode ─────────────────────────────────────────────────────────────

/**
 * Insert @effects annotations into source files via ts-morph manipulation.
 * Returns the number of annotations applied.
 *
 * @effects
 */
export function applyInferInsertions(
  result: InferResult,
  index: SymbolIndex,
  project: Project,
): number {
  let applied = 0

  // Build a lookup from (file, symbolName) → InferredAnnotation
  const byKey = new Map<string, InferredAnnotation>()
  for (const ann of result.inferred) {
    byKey.set(`${ann.file}:${ann.symbolName}`, ann)
  }

  // Group inferred annotations by file path for batch processing
  const byFile = new Map<string, InferredAnnotation[]>()
  for (const ann of result.inferred) {
    if (!byFile.has(ann.file)) byFile.set(ann.file, [])
    byFile.get(ann.file)!.push(ann)
  }

  for (const hit of index.hits) {
    // Find matching inferred annotation
    const parsed = parseAnnotations(hit.decl)
    const hasEffects = parsed.annotations.some((a) => a.kind === "effects")
    if (hasEffects) continue

    // Check if this hit has a corresponding inferred annotation
    // We match by symbol name since the hit's file path is absolute
    let matched: InferredAnnotation | undefined
    for (const ann of result.inferred) {
      if (ann.symbolName === hit.displayName) {
        const hitPath = hit.file.getFilePath()
        if (hitPath.endsWith(ann.file) || hitPath.includes(ann.file)) {
          matched = ann
          break
        }
      }
    }
    if (matched === undefined) continue

    const tag = matched.effects.length > 0
      ? `@effects ${matched.effects.join(", ")}`
      : "@effects"

    // Get the JSDocable node and add/update JSDoc
    const existingDocs = hit.decl.getJsDocs()
    if (existingDocs.length > 0) {
      // Has existing JSDoc — add tag to it
      const doc = existingDocs[existingDocs.length - 1]!
      doc.addTag({ tagName: "effects", text: matched.effects.length > 0 ? matched.effects.join(", ") : undefined })
    } else {
      // No JSDoc — add a new one before the declaration
      // We need the actual declaration node (function/variable statement)
      const decl = hit.decl
      if ("addJsDoc" in decl && typeof decl.addJsDoc === "function") {
        decl.addJsDoc({ tags: [{ tagName: "effects", text: matched.effects.length > 0 ? matched.effects.join(", ") : undefined }] })
      } else {
        // Fallback: insert comment text before the node
        const sf = hit.file
        const pos = decl.getStart()
        sf.insertText(pos, `/** ${tag} */\n`)
      }
    }
    applied++
  }

  return applied
}
