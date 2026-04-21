import { describe, expect, test } from "bun:test"
import {
  buildBaseline,
  filterBaselined,
  fingerprint,
  type BaselineSchema,
} from "../src/baseline.ts"
import type { Diagnostic } from "../src/diag/types.ts"

function makeDiag(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    code: "E0301",
    severity: "error",
    file: "src/foo.ts",
    line: 10,
    col: 5,
    len: 8,
    message: "effect 'fs.read' used by readFile not declared in @effects",
    docs: "https://hewg.dev/e/E0301",
    ...overrides,
  }
}

describe("fingerprint", () => {
  test("produces code::file::message format", () => {
    const d = makeDiag()
    expect(fingerprint(d)).toBe(
      "E0301::src/foo.ts::effect 'fs.read' used by readFile not declared in @effects",
    )
  })

  test("ignores line and col", () => {
    const d1 = makeDiag({ line: 10, col: 5 })
    const d2 = makeDiag({ line: 99, col: 1 })
    expect(fingerprint(d1)).toBe(fingerprint(d2))
  })

  test("different files produce different fingerprints", () => {
    const d1 = makeDiag({ file: "src/a.ts" })
    const d2 = makeDiag({ file: "src/b.ts" })
    expect(fingerprint(d1)).not.toBe(fingerprint(d2))
  })

  test("different codes produce different fingerprints", () => {
    const d1 = makeDiag({ code: "E0301" })
    const d2 = makeDiag({ code: "E0302" })
    expect(fingerprint(d1)).not.toBe(fingerprint(d2))
  })
})

describe("buildBaseline", () => {
  test("groups by fingerprint and counts", () => {
    const diags = [
      makeDiag({ line: 5 }),
      makeDiag({ line: 20 }),
      makeDiag({ file: "src/bar.ts", line: 1 }),
    ]
    const schema = buildBaseline(diags, "0.0.1")
    expect(schema.version).toBe(1)
    expect(schema.hewgVersion).toBe("0.0.1")
    expect(schema.count).toBe(3)
    // Two with same fingerprint (same file/code/message), one different
    const keys = Object.keys(schema.entries)
    expect(keys).toHaveLength(2)
    const fooKey = keys.find((k) => k.includes("src/foo.ts"))!
    const barKey = keys.find((k) => k.includes("src/bar.ts"))!
    expect(schema.entries[fooKey]).toBe(2)
    expect(schema.entries[barKey]).toBe(1)
  })

  test("entries are sorted alphabetically", () => {
    const diags = [
      makeDiag({ file: "src/z.ts" }),
      makeDiag({ file: "src/a.ts" }),
      makeDiag({ file: "src/m.ts" }),
    ]
    const schema = buildBaseline(diags, "0.0.1")
    const keys = Object.keys(schema.entries)
    expect(keys).toEqual([...keys].sort())
  })

  test("empty diagnostics produces empty baseline", () => {
    const schema = buildBaseline([], "0.0.1")
    expect(schema.count).toBe(0)
    expect(Object.keys(schema.entries)).toHaveLength(0)
  })
})

describe("filterBaselined", () => {
  const baseline: BaselineSchema = {
    version: 1,
    hewgVersion: "0.0.1",
    generatedAt: "2026-04-20T00:00:00.000Z",
    count: 3,
    entries: {
      "E0301::src/foo.ts::effect 'fs.read' used by readFile not declared in @effects": 2,
      "W0003::src/bar.ts::effect of callee unknown; treated as pure": 1,
    },
  }

  test("filters out baselined diagnostics", () => {
    const diags = [
      makeDiag({ line: 5 }),
      makeDiag({ line: 20 }),
      makeDiag({
        code: "W0003",
        severity: "warning",
        file: "src/bar.ts",
        message: "effect of callee unknown; treated as pure",
      }),
    ]
    const { remaining, fixed } = filterBaselined(diags, baseline)
    expect(remaining).toHaveLength(0)
    expect(fixed).toBe(0)
  })

  test("new violations pass through", () => {
    const diags = [
      makeDiag({ line: 5 }),
      makeDiag({ line: 20 }),
      makeDiag({ file: "src/new.ts", line: 3 }),
    ]
    const { remaining } = filterBaselined(diags, baseline)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].file).toBe("src/new.ts")
  })

  test("count exhaustion: 3 same fingerprints, 2 in baseline = 1 new", () => {
    const diags = [
      makeDiag({ line: 1 }),
      makeDiag({ line: 5 }),
      makeDiag({ line: 10 }),
    ]
    const { remaining } = filterBaselined(diags, baseline)
    expect(remaining).toHaveLength(1)
  })

  test("fixed count reflects entries no longer present", () => {
    // Only one of the 2 baselined foo.ts violations remains
    const diags = [makeDiag({ line: 5 })]
    const { remaining, fixed } = filterBaselined(diags, baseline)
    expect(remaining).toHaveLength(0)
    // 1 foo entry unused + 1 bar entry unused = 2 fixed
    expect(fixed).toBe(2)
  })

  test("empty baseline lets everything through", () => {
    const emptyBaseline: BaselineSchema = {
      version: 1,
      hewgVersion: "0.0.1",
      generatedAt: "2026-04-20T00:00:00.000Z",
      count: 0,
      entries: {},
    }
    const diags = [makeDiag()]
    const { remaining } = filterBaselined(diags, emptyBaseline)
    expect(remaining).toHaveLength(1)
  })

  test("results are deterministically sorted by file then line", () => {
    const diags = [
      makeDiag({ file: "src/z.ts", line: 1 }),
      makeDiag({ file: "src/a.ts", line: 5 }),
      makeDiag({ file: "src/a.ts", line: 2 }),
    ]
    const emptyBaseline: BaselineSchema = {
      version: 1,
      hewgVersion: "0.0.1",
      generatedAt: "2026-04-20T00:00:00.000Z",
      count: 0,
      entries: {},
    }
    const { remaining } = filterBaselined(diags, emptyBaseline)
    expect(remaining[0].file).toBe("src/a.ts")
    expect(remaining[0].line).toBe(2)
    expect(remaining[1].file).toBe("src/a.ts")
    expect(remaining[1].line).toBe(5)
    expect(remaining[2].file).toBe("src/z.ts")
  })
})
