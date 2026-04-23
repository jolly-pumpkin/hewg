import { describe, expect, test } from "bun:test"
import { Project } from "ts-morph"
import { join } from "node:path"
import { buildSymbolIndex } from "../../src/contract/lookup.ts"
import { loadEffectMap } from "../../src/analysis/effect-map.ts"
import {
  buildCallGraph,
  findNodeKey,
  formatScopeHuman,
  formatScopeJson,
  queryScope,
} from "../../src/analysis/call-graph.ts"

const CHECK_FIX = join(import.meta.dir, "../fixtures/check")

function loadFixture() {
  const tsconfigPath = join(CHECK_FIX, "tsconfig.json")
  const project = new Project({ tsConfigFilePath: tsconfigPath })
  const index = buildSymbolIndex(project)
  const effectMap = loadEffectMap()
  const opts = {
    effectMap,
    depthLimit: 10,
    unknownEffectPolicy: "warn" as const,
  }
  const graph = buildCallGraph(project, index, opts, CHECK_FIX)
  return { graph, index, project }
}

describe("buildCallGraph", () => {
  test("creates nodes for all exported functions", () => {
    const { graph, index } = loadFixture()

    // Every index hit should have a corresponding node
    for (const hit of index.hits) {
      const key = findNodeKey(graph, hit.displayName)
      expect(key).toBeDefined()
      const node = graph.nodes.get(key!)
      expect(node).toBeDefined()
      expect(node!.symbol).toBe(hit.displayName)
    }
  })

  test("creates forward edges for function calls", () => {
    const { graph } = loadFixture()
    const entryKey = findNodeKey(graph, "entry")!
    const callees = graph.forward.get(entryKey)!

    // entry calls helper, util, loop
    const calleeSymbols = [...callees].map((k) => graph.nodes.get(k)!.symbol)
    expect(calleeSymbols).toContain("helper")
    expect(calleeSymbols).toContain("util")
    expect(calleeSymbols).toContain("loop")
  })

  test("creates reverse edges", () => {
    const { graph } = loadFixture()
    const helperKey = findNodeKey(graph, "helper")!
    const callers = graph.reverse.get(helperKey)!

    const callerSymbols = [...callers].map((k) => graph.nodes.get(k)!.symbol)
    expect(callerSymbols).toContain("entry")
  })
})

describe("queryScope", () => {
  test("returns callees at correct depths", () => {
    const { graph } = loadFixture()
    const entryKey = findNodeKey(graph, "entry")!
    const result = queryScope(graph, entryKey, 5)!

    expect(result.target.symbol).toBe("entry")

    // Direct callees at depth 1
    const depth1 = result.callees.filter((e) => e.depth === 1)
    const depth1Names = depth1.map((e) => e.symbol)
    expect(depth1Names).toContain("helper")
    expect(depth1Names).toContain("util")
    expect(depth1Names).toContain("loop")
  })

  test("returns callers", () => {
    const { graph } = loadFixture()
    const helperKey = findNodeKey(graph, "helper")!
    const result = queryScope(graph, helperKey, 5)!

    expect(result.callers.length).toBeGreaterThan(0)
    expect(result.callers[0]!.symbol).toBe("entry")
    expect(result.callers[0]!.depth).toBe(1)
  })

  test("respects depth limit", () => {
    const { graph } = loadFixture()
    const entryKey = findNodeKey(graph, "entry")!
    const result = queryScope(graph, entryKey, 1)!

    // With depth 1, should only see direct callees
    for (const entry of result.callees) {
      expect(entry.depth).toBe(1)
    }
  })

  test("returns undefined for unknown key", () => {
    const { graph } = loadFixture()
    const result = queryScope(graph, "nonexistent::foo", 5)
    expect(result).toBeUndefined()
  })
})

describe("findNodeKey", () => {
  test("finds by display name", () => {
    const { graph } = loadFixture()
    const key = findNodeKey(graph, "entry")
    expect(key).toBeDefined()
    expect(graph.nodes.get(key!)!.symbol).toBe("entry")
  })

  test("returns undefined for unknown symbol", () => {
    const { graph } = loadFixture()
    expect(findNodeKey(graph, "doesNotExist")).toBeUndefined()
  })
})

describe("formatScopeHuman", () => {
  test("includes target, callees, and callers sections", () => {
    const { graph } = loadFixture()
    const entryKey = findNodeKey(graph, "entry")!
    const result = queryScope(graph, entryKey, 5)!
    const output = formatScopeHuman(result)

    expect(output).toContain("scope: entry")
    expect(output).toContain("callees (")
    expect(output).toContain("callers (")
    expect(output).toContain("helper")
  })
})

describe("formatScopeJson", () => {
  test("produces valid JSON with target, callees, callers", () => {
    const { graph } = loadFixture()
    const entryKey = findNodeKey(graph, "entry")!
    const result = queryScope(graph, entryKey, 5)!
    const json = JSON.parse(formatScopeJson(result))

    expect(json.target.symbol).toBe("entry")
    expect(Array.isArray(json.callees)).toBe(true)
    expect(Array.isArray(json.callers)).toBe(true)
  })
})
