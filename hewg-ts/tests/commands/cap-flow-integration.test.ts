import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import { runCheck } from "../../src/commands/check.ts"
import type { Diagnostic } from "../../src/diag/types.ts"

const FIXTURE_DIR = resolve(import.meta.dirname, "../fixtures/cap-flow")
const FIXTURE_TSCONFIG = resolve(FIXTURE_DIR, "tsconfig.json")

function runJson(): Diagnostic[] {
  const result = runCheck({ project: FIXTURE_TSCONFIG, format: "json" })
  expect(result.stderr).toBe("")
  const stdout = result.stdout.trim()
  if (stdout.length === 0) return []
  return stdout.split("\n").map((l) => JSON.parse(l) as Diagnostic)
}

describe("hewg check — cap-flow fixture", () => {
  const diags = runJson()

  test("caller-ok.ts emits no diagnostics", () => {
    const okDiags = diags.filter((d) => d.file === "src/caller-ok.ts")
    expect(okDiags).toEqual([])
  })

  test("refund.ts (annotated callee) emits no diagnostics", () => {
    const refundDiags = diags.filter((d) => d.file === "src/refund.ts")
    expect(refundDiags).toEqual([])
  })

  test("caller-scope.ts produces E0401 (scope mismatch)", () => {
    const caps = diags.filter(
      (d) => d.file === "src/caller-scope.ts" && d.code.startsWith("E04"),
    )
    expect(caps.length).toBe(1)
    const e0401 = caps[0]!
    expect(e0401.code).toBe("E0401")
    expect(e0401.severity).toBe("error")
    expect(e0401.message).toContain("api.stripe.com")
    expect(e0401.message).toContain("api.paypal.com")
    expect(e0401.message).toContain("host")
    expect(e0401.related).toBeDefined()
    expect(e0401.related![0]!.message).toContain("callee requires @cap")
  })

  test("caller-missing.ts produces E0402 (missing capability)", () => {
    const caps = diags.filter(
      (d) => d.file === "src/caller-missing.ts" && d.code.startsWith("E04"),
    )
    expect(caps.length).toBe(1)
    const e0402 = caps[0]!
    expect(e0402.code).toBe("E0402")
    expect(e0402.severity).toBe("error")
    expect(e0402.message).toContain("refund")
    expect(e0402.message).toContain("http")
    expect(e0402.suggest).toBeDefined()
    expect(e0402.suggest![0]!.kind).toBe("add-cap")
    expect(e0402.suggest![0]!.insert).toContain("@cap http net.https")
  })

  test("caller-wrongname.ts produces E0403 (wrong parameter name)", () => {
    const caps = diags.filter(
      (d) => d.file === "src/caller-wrongname.ts" && d.code.startsWith("E04"),
    )
    expect(caps.length).toBe(1)
    const e0403 = caps[0]!
    expect(e0403.code).toBe("E0403")
    expect(e0403.severity).toBe("error")
    expect(e0403.message).toContain("client")
    expect(e0403.message).toContain("http")
    expect(e0403.suggest).toBeDefined()
    expect(e0403.suggest![0]!.kind).toBe("rename-arg")
    expect(e0403.suggest![0]!.insert).toBe("http")
  })

  test("one diagnostic per E04xx code across the fixture", () => {
    const codes = diags.filter((d) => d.code.startsWith("E04")).map((d) => d.code)
    expect(codes.sort()).toEqual(["E0401", "E0402", "E0403"])
  })

  test("exit code is 1 when cap-flow errors exist", () => {
    const result = runCheck({ project: FIXTURE_TSCONFIG, format: "json" })
    expect(result.exitCode).toBe(1)
  })
})
