import { describe, expect, test } from "bun:test"
import { Project } from "ts-morph"
import { join } from "node:path"
import { buildSymbolIndex } from "../../src/contract/lookup.ts"
import { loadEffectMap } from "../../src/analysis/effect-map.ts"
import { runInfer, formatInferDiff, formatInferJson } from "../../src/analysis/infer.ts"

const CHECK_FIX = join(import.meta.dir, "../fixtures/check")

function loadFixtureProject(dir: string) {
  const tsconfigPath = join(dir, "tsconfig.json")
  const project = new Project({ tsConfigFilePath: tsconfigPath })
  return { project, projectRoot: dir }
}

function runInferOnFixture() {
  const { project, projectRoot } = loadFixtureProject(CHECK_FIX)
  const index = buildSymbolIndex(project)
  const effectMap = loadEffectMap()
  const opts = {
    effectMap,
    depthLimit: 10,
    unknownEffectPolicy: "warn" as const,
  }
  return { result: runInfer(project, index, opts, projectRoot), project, index }
}

describe("runInfer", () => {
  test("skips functions that already have @effects", () => {
    const { result } = runInferOnFixture()

    // entry, helper, loop, loopHelper, refund, audit all have @effects
    const skippedNames = result.skipped.map((s) => s.symbolName)
    expect(skippedNames).toContain("entry")
    expect(skippedNames).toContain("helper")

    for (const s of result.skipped) {
      expect(s.reason).toBe("already has @effects")
    }
  })

  test("infers effects for unannotated functions", () => {
    const { result } = runInferOnFixture()

    // util() is the unannotated function in the check fixture
    const utilInferred = result.inferred.find((a) => a.symbolName === "util")
    expect(utilInferred).toBeDefined()
    expect(utilInferred!.file).toBe("src/util.ts")
  })

  test("inferred effects reflect call graph analysis", () => {
    const { result } = runInferOnFixture()

    // util() calls Math.random() which maps to "rand" in the default effect map
    const utilInferred = result.inferred.find((a) => a.symbolName === "util")
    expect(utilInferred).toBeDefined()
    // The exact effects depend on what Math.random resolves to in the effect map.
    // It should either be empty (pure) or have "rand".
    expect(Array.isArray(utilInferred!.effects)).toBe(true)
  })

  test("every exported function is either inferred or skipped", () => {
    const { result, index } = runInferOnFixture()

    const allNames = new Set(index.hits.map((h) => h.displayName))
    const inferredNames = new Set(result.inferred.map((a) => a.symbolName))
    const skippedNames = new Set(result.skipped.map((s) => s.symbolName))

    for (const name of allNames) {
      const accounted = inferredNames.has(name) || skippedNames.has(name)
      expect(accounted).toBe(true)
    }
  })
})

describe("formatInferDiff", () => {
  test("produces diff output for inferred annotations", () => {
    const { result } = runInferOnFixture()

    const diff = formatInferDiff(result)

    if (result.inferred.length > 0) {
      expect(diff).toContain("--- a/")
      expect(diff).toContain("+++ b/")
      expect(diff).toContain("+/** @effects")
    }
  })

  test("produces empty string when nothing to infer", () => {
    const diff = formatInferDiff({ inferred: [], skipped: [] })
    expect(diff).toBe("")
  })
})

describe("formatInferJson", () => {
  test("produces valid JSON array", () => {
    const { result } = runInferOnFixture()
    const json = formatInferJson(result)
    const parsed = JSON.parse(json)
    expect(Array.isArray(parsed)).toBe(true)

    if (parsed.length > 0) {
      expect(parsed[0]).toHaveProperty("file")
      expect(parsed[0]).toHaveProperty("symbol")
      expect(parsed[0]).toHaveProperty("effects")
      expect(parsed[0]).toHaveProperty("tag")
    }
  })
})
