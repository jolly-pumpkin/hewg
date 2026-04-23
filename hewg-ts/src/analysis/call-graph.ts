// Bidirectional call graph builder.
//
// Builds a graph of function → function edges (forward and reverse) from the
// SymbolIndex. Used by `hewg scope` to answer "what is the blast radius of
// changing this function?"

import { relative } from "node:path"
import type { Project } from "ts-morph"
import { parseAnnotations } from "../annotations/parser.ts"
import type { EffectName } from "../annotations/types.ts"
import type { SymbolIndex } from "../contract/lookup.ts"
import { resolveCalleeEffects, type EffectPropOptions } from "./effect-prop.ts"

// ── Types ──────────────────────────────────────────────────────────────────

export type CallGraphNode = {
  symbol: string
  file: string
  effects: EffectName[]
}

export type CallGraphEdge = {
  caller: string
  callee: string
}

export type CallGraph = {
  nodes: Map<string, CallGraphNode>
  forward: Map<string, Set<string>>   // caller → callees
  reverse: Map<string, Set<string>>   // callee → callers
}

export type ScopeEntry = {
  symbol: string
  file: string
  effects: EffectName[]
  depth: number
}

export type ScopeResult = {
  target: CallGraphNode
  callees: ScopeEntry[]
  callers: ScopeEntry[]
}

// ── Graph construction ─────────────────────────────────────────────────────

/**
 * Build a bidirectional call graph from the project's exported functions.
 *
 * For each exported function, resolve its callees. If a callee matches
 * another exported function in the index, create a forward + reverse edge.
 *
 * @hewg-module analysis/call-graph
 * @effects
 */
export function buildCallGraph(
  project: Project,
  index: SymbolIndex,
  opts: EffectPropOptions,
  projectRoot: string,
): CallGraph {
  const nodes = new Map<string, CallGraphNode>()
  const forward = new Map<string, Set<string>>()
  const reverse = new Map<string, Set<string>>()

  // Build node map: symbol → node
  // Use file-qualified keys to handle same-name functions in different files
  const hitsByLabel = new Map<string, string>() // callee label → node key

  for (const hit of index.hits) {
    const relFile = relative(projectRoot, hit.file.getFilePath())
    const key = `${relFile}::${hit.displayName}`
    const parsed = parseAnnotations(hit.decl)
    const effectsAnn = parsed.annotations.find((a) => a.kind === "effects")
    const effects: EffectName[] = effectsAnn?.kind === "effects" ? [...effectsAnn.effects] : []

    nodes.set(key, { symbol: hit.displayName, file: relFile, effects })
    forward.set(key, new Set())
    reverse.set(key, new Set())

    // Register this symbol under its display name for callee matching
    hitsByLabel.set(hit.displayName, key)
  }

  // Build edges
  for (const hit of index.hits) {
    const relFile = relative(projectRoot, hit.file.getFilePath())
    const callerKey = `${relFile}::${hit.displayName}`
    const callees = resolveCalleeEffects(hit.fn, project, index, opts)

    const seen = new Set<string>()
    for (const entry of callees) {
      // Try to match the callee label to a known node
      const calleeKey = hitsByLabel.get(entry.label)
      if (calleeKey === undefined) continue
      if (calleeKey === callerKey) continue // skip self-calls
      if (seen.has(calleeKey)) continue
      seen.add(calleeKey)

      forward.get(callerKey)!.add(calleeKey)
      if (!reverse.has(calleeKey)) reverse.set(calleeKey, new Set())
      reverse.get(calleeKey)!.add(callerKey)
    }
  }

  return { nodes, forward, reverse }
}

// ── Scope query ────────────────────────────────────────────────────────────

/**
 * BFS from a target node in both directions (callees and callers) up to
 * a given depth limit.
 *
 * @effects
 */
export function queryScope(
  graph: CallGraph,
  targetKey: string,
  depthLimit: number,
): ScopeResult | undefined {
  const target = graph.nodes.get(targetKey)
  if (target === undefined) return undefined

  const callees = bfs(graph, targetKey, "forward", depthLimit)
  const callers = bfs(graph, targetKey, "reverse", depthLimit)

  return { target, callees, callers }
}

/**
 * Find the node key for a symbol name. Tries exact match first,
 * then falls back to suffix match on displayName.
 *
 * @effects
 */
export function findNodeKey(graph: CallGraph, query: string): string | undefined {
  // Exact key match (file::name)
  if (graph.nodes.has(query)) return query

  // Match by display name
  const matches: string[] = []
  for (const [key, node] of graph.nodes) {
    if (node.symbol === query) matches.push(key)
  }

  if (matches.length === 1) return matches[0]
  return undefined // ambiguous or not found
}

function bfs(
  graph: CallGraph,
  start: string,
  direction: "forward" | "reverse",
  depthLimit: number,
): ScopeEntry[] {
  const adjacency = direction === "forward" ? graph.forward : graph.reverse
  const result: ScopeEntry[] = []
  const visited = new Set<string>([start])
  let frontier = [start]
  let depth = 0

  while (frontier.length > 0 && depth < depthLimit) {
    depth++
    const next: string[] = []
    for (const key of frontier) {
      const neighbors = adjacency.get(key)
      if (neighbors === undefined) continue
      for (const n of neighbors) {
        if (visited.has(n)) continue
        visited.add(n)
        const node = graph.nodes.get(n)
        if (node === undefined) continue
        result.push({
          symbol: node.symbol,
          file: node.file,
          effects: node.effects,
          depth,
        })
        next.push(n)
      }
    }
    frontier = next
  }

  return result
}

// ── Formatting ─────────────────────────────────────────────────────────────

/**
 * Render a ScopeResult as human-readable text.
 *
 * @effects
 */
export function formatScopeHuman(result: ScopeResult): string {
  const lines: string[] = []
  const targetEffects = result.target.effects.length > 0
    ? result.target.effects.join(", ")
    : "pure"

  lines.push(`scope: ${result.target.symbol} (${result.target.file})`)
  lines.push(`  @effects ${targetEffects}`)
  lines.push("")

  lines.push(`callees (${result.callees.length}):`)
  if (result.callees.length === 0) {
    lines.push("  (none)")
  } else {
    for (const entry of result.callees) {
      const effs = entry.effects.length > 0 ? entry.effects.join(", ") : "pure"
      const indent = "  ".repeat(entry.depth)
      lines.push(`${indent}${entry.symbol} (${entry.file})  @effects ${effs}  depth=${entry.depth}`)
    }
  }

  lines.push("")
  lines.push(`callers (${result.callers.length}):`)
  if (result.callers.length === 0) {
    lines.push("  (none)")
  } else {
    for (const entry of result.callers) {
      const effs = entry.effects.length > 0 ? entry.effects.join(", ") : "pure"
      const indent = "  ".repeat(entry.depth)
      lines.push(`${indent}${entry.symbol} (${entry.file})  @effects ${effs}  depth=${entry.depth}`)
    }
  }

  return lines.join("\n")
}

/**
 * Render a ScopeResult as JSON.
 *
 * @effects
 */
export function formatScopeJson(result: ScopeResult): string {
  return JSON.stringify({
    target: result.target,
    callees: result.callees,
    callers: result.callers,
  }, null, 2)
}
