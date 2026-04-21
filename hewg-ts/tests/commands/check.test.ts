import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import { runCheck } from "../../src/commands/check.ts"
import type { Diagnostic } from "../../src/diag/types.ts"

const FIXTURE_DIR = resolve(import.meta.dirname, "../fixtures/check")
const FIXTURE_TSCONFIG = resolve(FIXTURE_DIR, "tsconfig.json")

const CONTRACT_FIXTURE_TSCONFIG = resolve(
  import.meta.dirname,
  "../fixtures/contract/tsconfig.json",
)

function runJson(tsconfig: string): Diagnostic[] {
  const result = runCheck({ project: tsconfig, format: "json" })
  expect(result.stderr).toBe("")
  const stdout = result.stdout.trim()
  if (stdout.length === 0) return []
  return stdout.split("\n").map((l) => JSON.parse(l) as Diagnostic)
}

describe("hewg check — integration fixture", () => {
  const diags = runJson(FIXTURE_TSCONFIG)

  test("exit code is 1 when errors exist", () => {
    const result = runCheck({ project: FIXTURE_TSCONFIG, format: "json" })
    expect(result.exitCode).toBe(1)
  })

  test("produces exactly one diagnostic per expected site", () => {
    const keys = diags.map((d) => `${d.code}:${d.file}:${d.line}:${d.col}:${d.len}`)
    expect(keys.sort()).toEqual(
      [
        "E0301:src/audit.ts:8:23:11",
        "E0301:src/entry.ts:10:9:6",
        "E0301:src/entry.ts:11:3:4",
        "E0301:src/refund-broken.ts:14:9:5",
        "E0301:src/refund-broken.ts:15:3:12",
        "W0003:src/unknown.ts:8:3:13",
      ].sort(),
    )
  })

  test("no diagnostics on clean files", () => {
    for (const d of diags) {
      expect(d.file).not.toBe("src/refund.ts")
      expect(d.file).not.toBe("src/helper.ts")
      expect(d.file).not.toBe("src/loop.ts")
    }
  })

  test("audit.ts E0301 matches the registered example shape", () => {
    const audit = diags.find(
      (d) => d.code === "E0301" && d.file === "src/audit.ts",
    )
    expect(audit).toBeDefined()
    expect(audit!.line).toBe(8)
    expect(audit!.col).toBe(23)
    expect(audit!.len).toBe(11)
    expect(audit!.message).toContain("fs.readFile")
    expect(audit!.message).toContain("fs.read")

    expect(audit!.related).toBeDefined()
    expect(audit!.related![0]!.line).toBe(4)
    expect(audit!.related![0]!.col).toBe(13)
    expect(audit!.related![0]!.len).toBe(3)

    expect(audit!.suggest).toBeDefined()
    expect(audit!.suggest!.length).toBe(2)
    expect(audit!.suggest![0]!.kind).toBe("add-effect")
    expect(audit!.suggest![0]!.insert).toBe(", fs.read")
    expect(audit!.suggest![0]!.at.line).toBe(4)
    expect(audit!.suggest![0]!.at.col).toBe(16)
    expect(audit!.suggest![0]!.at.len).toBe(0)
    expect(audit!.suggest![1]!.kind).toBe("add-cap")
  })

  test("cycle does not cause hang or spurious diagnostics", () => {
    for (const d of diags) expect(d.file).not.toBe("src/loop.ts")
  })

  test("W0003 fires on unknown callee", () => {
    const w = diags.find((d) => d.code === "W0003")
    expect(w).toBeDefined()
    expect(w!.file).toBe("src/unknown.ts")
    expect(w!.severity).toBe("warning")
    expect(w!.message).toContain("externalThing")
  })

  test("broken refund emits E0301 for each missing effect", () => {
    const rb = diags.filter(
      (d) => d.code === "E0301" && d.file === "src/refund-broken.ts",
    )
    const inserts = rb.map((d) => d.suggest?.[0]?.insert)
    expect(inserts).toEqual(
      expect.arrayContaining([", net.https", ", fs.write"]),
    )
  })
})

describe("hewg check — §1 refund.ts is clean", () => {
  test("contract fixture refund.ts produces zero diagnostics", () => {
    const diags = runJson(CONTRACT_FIXTURE_TSCONFIG)
    expect(diags).toEqual([])
  })
})

describe("hewg check — per-package trust", () => {
  // The existing unknown.ts fixture has `externalThing()` which is a bare
  // identifier with no package — it should still emit W0003 even with
  // defaultPackagePolicy: "pure" because no package name can be determined.
  test("defaultPackagePolicy does not suppress W0003 for unresolvable identifiers", () => {
    const result = runCheck({ project: FIXTURE_TSCONFIG, format: "json" })
    const stdout = result.stdout.trim()
    const diags: Diagnostic[] = stdout.length === 0 ? [] : stdout.split("\n").map(l => JSON.parse(l) as Diagnostic)
    const w0003 = diags.filter(d => d.code === "W0003")
    expect(w0003.length).toBeGreaterThan(0)
    expect(w0003[0]!.message).toContain("externalThing")
  })
})

describe("hewg check — error paths", () => {
  test("missing tsconfig emits E0001 and exits 1", () => {
    const result = runCheck({
      project: "/nonexistent/path/tsconfig.json",
      format: "json",
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("E0001")
  })
})
