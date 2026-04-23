// CLAUDE.md generator.
//
// Produces a Markdown document that explains Hewg annotations and maps
// the project architecture by effect boundary. Designed to be consumed
// by LLM coding agents (Claude, Copilot, Cursor, etc.).

import { relative } from "node:path"
import type { Project } from "ts-morph"
import { parseAnnotations } from "../annotations/parser.ts"
import type { EffectName, ParsedAnnotation } from "../annotations/types.ts"
import type { EffectPropOptions } from "../analysis/effect-prop.ts"
import { resolveCalleeEffects } from "../analysis/effect-prop.ts"
import type { ExportHit, SymbolIndex } from "../contract/lookup.ts"

// ── Public API ──────────────────────────────────────────────────────────────

export type ClaudeMdOptions = {
  index: SymbolIndex
  project: Project
  effectPropOpts: EffectPropOptions
  projectRoot: string
}

export type EffectBoundary = {
  symbol: string
  file: string
  declaredEffects: readonly EffectName[]
  callees: { label: string; effects: readonly EffectName[] }[]
}

/**
 * Generate a CLAUDE.md document from the project's annotation graph.
 *
 * @hewg-module generators/claude-md
 * @effects
 */
export function generateClaudeMd(opts: ClaudeMdOptions): string {
  const { index, project, effectPropOpts, projectRoot } = opts

  const fileEffects = buildFileEffectsMap(index, projectRoot)
  const pureFiles = [...fileEffects.entries()]
    .filter(([, effs]) => effs.size === 0)
    .map(([f]) => f)
    .sort()
  const effectfulFiles = [...fileEffects.entries()]
    .filter(([, effs]) => effs.size > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
  const boundaries = buildEffectBoundaries(index, project, effectPropOpts, projectRoot)

  const sections: string[] = [
    renderSchemaSection(),
    renderDecisionTable(),
    renderArchitectureMap(pureFiles, effectfulFiles),
    renderCallGraph(boundaries),
    renderCheatSheet(),
  ]

  return sections.filter((s) => s.length > 0).join("\n\n")
}

// ── Marker helpers ──────────────────────────────────────────────────────────

const MARKER_START = "<!-- hewg:start -->"
const MARKER_END = "<!-- hewg:end -->"

/**
 * Insert or replace the hewg-generated section in an existing CLAUDE.md.
 * Returns the full document content.
 *
 * @effects
 */
export function spliceIntoExisting(existing: string, generated: string): string {
  const startIdx = existing.indexOf(MARKER_START)
  const endIdx = existing.indexOf(MARKER_END)

  const wrapped = `${MARKER_START}\n${generated}\n${MARKER_END}`

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace existing section
    const before = existing.slice(0, startIdx)
    const after = existing.slice(endIdx + MARKER_END.length)
    return before + wrapped + after
  }

  // No markers found — append
  const sep = existing.endsWith("\n") ? "\n" : "\n\n"
  return existing + sep + wrapped + "\n"
}

/**
 * Wrap generated content with markers for a fresh CLAUDE.md.
 *
 * @effects
 */
export function wrapWithMarkers(generated: string): string {
  return `${MARKER_START}\n${generated}\n${MARKER_END}\n`
}

// ── Data builders ───────────────────────────────────────────────────────────

function buildFileEffectsMap(
  index: SymbolIndex,
  projectRoot: string,
): Map<string, Set<EffectName>> {
  const map = new Map<string, Set<EffectName>>()

  for (const hit of index.hits) {
    const relFile = relative(projectRoot, hit.file.getFilePath())
    if (!map.has(relFile)) map.set(relFile, new Set())
    const parsed = parseAnnotations(hit.decl)
    for (const ann of parsed.annotations) {
      if (ann.kind === "effects") {
        const fileSet = map.get(relFile)!
        for (const e of ann.effects) fileSet.add(e)
      }
    }
  }

  return map
}

function buildEffectBoundaries(
  index: SymbolIndex,
  project: Project,
  opts: EffectPropOptions,
  projectRoot: string,
): EffectBoundary[] {
  const boundaries: EffectBoundary[] = []

  for (const hit of index.hits) {
    const parsed = parseAnnotations(hit.decl)
    const effectsAnn = parsed.annotations.find((a): a is ParsedAnnotation & { kind: "effects" } => a.kind === "effects")
    if (effectsAnn === undefined) continue
    if (effectsAnn.effects.length === 0) continue // skip pure functions

    const callees = resolveCalleeEffects(hit.fn, project, index, opts)
    // Deduplicate callees by label
    const seen = new Set<string>()
    const uniqueCallees: { label: string; effects: readonly EffectName[] }[] = []
    for (const entry of callees) {
      if (seen.has(entry.label)) continue
      seen.add(entry.label)
      uniqueCallees.push({ label: entry.label, effects: [...entry.effects] })
    }

    if (uniqueCallees.length === 0) continue

    boundaries.push({
      symbol: hit.displayName,
      file: relative(projectRoot, hit.file.getFilePath()),
      declaredEffects: [...effectsAnn.effects],
      callees: uniqueCallees,
    })
  }

  return boundaries
}

// ── Section renderers ───────────────────────────────────────────────────────

function renderSchemaSection(): string {
  return `# Hewg Annotation Guide

This project uses Hewg annotations in JSDoc comments to declare function contracts.

## Annotations

- \`@effects <list>\` — Declares what side effects a function performs. An empty \`@effects\` (no list) means the function is **pure** — no IO, no side effects. Common effects:
  - \`net.https\` / \`net.http\` — makes HTTP requests
  - \`fs.read\` — reads from the filesystem
  - \`fs.write\` — writes to the filesystem
  - \`log\` — writes to console/stdout
  - \`proc.exec\` / \`proc.spawn\` — runs child processes
  - \`rand\` — uses random number generation
  - \`time.read\` / \`time.sleep\` — reads clock or sleeps
- \`@hewg-module <path>\` — Declares which module a file belongs to.
- \`@cap <name> <effect>\` — Declares a capability parameter the function requires.
- \`@pre <condition>\` — Precondition that must hold when calling the function.
- \`@post <condition>\` — Postcondition guaranteed after the function returns.
- \`@idempotent\` — Function is safe to call multiple times with the same arguments.
- \`@layer <tier>\` — Architectural tier: \`api\`, \`service\`, \`command\`, \`output\`, or \`lib\`.`
}

function renderDecisionTable(): string {
  return `## Rules for modifying annotated code

| You want to... | Check | Action |
|-----------------|-------|--------|
| Add IO (fetch, console.log, fs) to a function | Does \`@effects\` have no listed effects? | **STOP.** The function is pure. Add the IO in a caller that already declares the relevant effect. |
| Add IO to a function | Does \`@effects\` already list the needed effect? | Proceed — the function already performs this kind of IO. |
| Add IO to a function | \`@effects\` lists other effects but not this one | Update \`@effects\` to include the new effect, or move the IO to a different function. |
| Call a new function from an existing one | Does the callee have effects the caller lacks? | **STOP.** You would introduce an undeclared effect. Move the call to an appropriate site. |
| Create a new function | — | Add \`@effects\` listing every IO it performs. If none, use empty \`@effects\`. |
| Modify a function with \`@pre\`/\`@post\` | — | Ensure your changes preserve the preconditions and postconditions. |`
}

function renderArchitectureMap(
  pureFiles: string[],
  effectfulFiles: [string, Set<EffectName>][],
): string {
  if (pureFiles.length === 0 && effectfulFiles.length === 0) return ""

  const lines: string[] = ["## Architecture (by effect boundary)"]

  if (pureFiles.length > 0) {
    lines.push("")
    lines.push("**Pure (no effects):**")
    for (const f of pureFiles) lines.push(`- \`${f}\``)
  }

  // Group effectful files by their effect set
  const groups = new Map<string, string[]>()
  for (const [file, effs] of effectfulFiles) {
    const key = [...effs].sort().join(", ")
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(file)
  }

  for (const [effects, files] of groups) {
    lines.push("")
    lines.push(`**${effects}:**`)
    for (const f of files.sort()) lines.push(`- \`${f}\``)
  }

  return lines.join("\n")
}

function renderCallGraph(boundaries: EffectBoundary[]): string {
  if (boundaries.length === 0) return ""

  const lines: string[] = ["## Effect call graph"]
  lines.push("")
  lines.push("Functions with effects and their callees:")
  lines.push("")

  for (const b of boundaries) {
    lines.push(`**${b.symbol}** (\`${b.file}\`) \`@effects ${b.declaredEffects.join(", ")}\``)
    for (const c of b.callees) {
      const effs = c.effects.length > 0 ? c.effects.join(", ") : "pure"
      lines.push(`  → ${c.label} [${effs}]`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

function renderCheatSheet(): string {
  return `## Quick reference

- \`@effects\` (empty) = **pure function** — no IO allowed
- \`@effects net.https, fs.write\` = function performs these IO operations (and only these)
- \`@idempotent\` = safe to retry or cache`
}
