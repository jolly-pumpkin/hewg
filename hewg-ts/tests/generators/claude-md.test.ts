import { describe, expect, test } from "bun:test"
import { generateClaudeMd, spliceIntoExisting, wrapWithMarkers } from "../../src/generators/claude-md.ts"
import { loadEffectMap } from "../../src/analysis/effect-map.ts"
import { buildSymbolIndex } from "../../src/contract/lookup.ts"
import { Project } from "ts-morph"
import { join } from "node:path"

const CHECK_FIX = join(import.meta.dir, "../fixtures/check")

function loadFixtureProject(dir: string) {
  const tsconfigPath = join(dir, "tsconfig.json")
  const project = new Project({ tsConfigFilePath: tsconfigPath })
  return { project, projectRoot: dir }
}

describe("generateClaudeMd", () => {
  test("produces all expected sections on check fixture", () => {
    const { project, projectRoot } = loadFixtureProject(CHECK_FIX)
    const index = buildSymbolIndex(project)
    const effectMap = loadEffectMap()

    const output = generateClaudeMd({
      index,
      project,
      effectPropOpts: {
        effectMap,
        depthLimit: 10,
        unknownEffectPolicy: "warn",
      },
      projectRoot,
    })

    // Schema section
    expect(output).toContain("# Hewg Annotation Guide")
    expect(output).toContain("`@effects <list>`")
    expect(output).toContain("`@idempotent`")
    expect(output).toContain("`@layer <tier>`")

    // Decision table
    expect(output).toContain("## Rules for modifying annotated code")
    expect(output).toContain("**STOP.**")

    // Architecture map
    expect(output).toContain("## Architecture (by effect boundary)")
    expect(output).toContain("**Pure (no effects):**")

    // Call graph
    expect(output).toContain("## Effect call graph")

    // Quick reference
    expect(output).toContain("## Quick reference")
    expect(output).toContain("pure function")
  })

  test("lists pure files separately from effectful files", () => {
    const { project, projectRoot } = loadFixtureProject(CHECK_FIX)
    const index = buildSymbolIndex(project)
    const effectMap = loadEffectMap()

    const output = generateClaudeMd({
      index,
      project,
      effectPropOpts: {
        effectMap,
        depthLimit: 10,
        unknownEffectPolicy: "warn",
      },
      projectRoot,
    })

    // The check fixture has src/util.ts which is pure
    expect(output).toContain("src/util.ts")
    // The check fixture has effectful files
    expect(output).toContain("log")
  })
})

describe("spliceIntoExisting", () => {
  test("replaces content between existing markers", () => {
    const existing = "# My Project\n\nSome text\n\n<!-- hewg:start -->\nold content\n<!-- hewg:end -->\n\nMore text\n"
    const result = spliceIntoExisting(existing, "new content")
    expect(result).toContain("# My Project")
    expect(result).toContain("new content")
    expect(result).not.toContain("old content")
    expect(result).toContain("More text")
    expect(result).toContain("<!-- hewg:start -->")
    expect(result).toContain("<!-- hewg:end -->")
  })

  test("appends with markers when no existing markers", () => {
    const existing = "# My Project\n\nSome text\n"
    const result = spliceIntoExisting(existing, "generated")
    expect(result).toContain("# My Project")
    expect(result).toContain("<!-- hewg:start -->")
    expect(result).toContain("generated")
    expect(result).toContain("<!-- hewg:end -->")
  })

  test("idempotent on second run", () => {
    const existing = "# Existing\n"
    const first = spliceIntoExisting(existing, "content v1")
    const second = spliceIntoExisting(first, "content v1")
    expect(first).toBe(second)
  })
})

describe("wrapWithMarkers", () => {
  test("wraps content with start/end markers", () => {
    const result = wrapWithMarkers("hello")
    expect(result).toBe("<!-- hewg:start -->\nhello\n<!-- hewg:end -->\n")
  })
})
