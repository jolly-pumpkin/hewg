import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import { getEncoding } from "js-tiktoken"
import { runSummary } from "../../src/commands/summary.ts"

const CLI_ENTRY = new URL("../../src/cli.ts", import.meta.url).pathname
const FIXTURE_DIR = resolve(import.meta.dirname, "../fixtures/summary")
const FIXTURE_TSCONFIG = resolve(FIXTURE_DIR, "tsconfig.json")

type RunResult = { code: number; stdout: string; stderr: string }

async function runCli(args: string[]): Promise<RunResult> {
  const proc = Bun.spawn({
    cmd: [process.execPath, "run", CLI_ENTRY, ...args],
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { code, stdout, stderr }
}

describe("hewg summary (annotated module)", () => {
  test("matches the §7.3 format for payments/refund", async () => {
    const { code, stdout, stderr } = await runCli([
      "summary",
      "payments/refund",
      "--project",
      FIXTURE_TSCONFIG,
    ])
    expect(code).toBe(0)
    expect(stderr.trim()).toBe("")

    const lines = stdout.split("\n")
    expect(lines[0]).toBe("module payments/refund (src/refund.ts)")
    expect(lines[1]).toBe("  effects: net.https, fs.write, log")
    expect(lines[2]).toBe("")
    expect(lines[3]).toBe("exports:")
    expect(lines[4]).toBe(
      "  refund(http, fs, log, chargeId, amountCents) => unknown",
    )
    expect(lines[5]).toBe(
      "      caps:    http@api.stripe.com:443, fs@./receipts/, log",
    )
    expect(lines[6]).toBe("      pre:     amountCents > 0")
    expect(lines[7]).toBe("      cost:    120 tok, ~6 ops, <=3 net, <=5s")
    expect(lines[8]).toBe(
      "  type RefundError    \u2014 2 variants (NotFound, Upstream)",
    )
    expect(lines[9]).toBe("  type RefundReceipt  \u2014 3 fields")
  })
})

describe("hewg summary (zero-annotation module)", () => {
  test("prints module header without effects line; lists signature", async () => {
    const { code, stdout } = await runCli([
      "summary",
      "utils/bare",
      "--project",
      FIXTURE_TSCONFIG,
    ])
    expect(code).toBe(0)
    const lines = stdout.split("\n")
    expect(lines[0]).toBe("module utils/bare (src/unannotated.ts)")
    // No effects line.
    expect(lines[1]).toBe("")
    expect(lines[2]).toBe("exports:")
    expect(lines[3]).toBe("  bare(x) => number")
    // No indented metadata lines.
    for (const l of lines.slice(4)) {
      expect(l.startsWith("      ")).toBe(false)
    }
  })
})

describe("hewg summary (module not found)", () => {
  test("emits E0003 with exit 1 and includes suggestion when close", async () => {
    const { code, stdout, stderr } = await runCli([
      "summary",
      "payments/refnud",
      "--project",
      FIXTURE_TSCONFIG,
    ])
    expect(code).toBe(1)
    expect(stdout.trim()).toBe("")
    const diag = JSON.parse(stderr.trim())
    expect(diag.code).toBe("E0003")
    expect(diag.message).toContain("payments/refnud")
    expect(diag.suggest).toBeDefined()
    expect(diag.suggest[0].insert).toBe("payments/refund")
  })

  test("emits E0003 with no suggestions for a wildly off name", async () => {
    const { code, stderr } = await runCli([
      "summary",
      "zzz/nope",
      "--project",
      FIXTURE_TSCONFIG,
    ])
    expect(code).toBe(1)
    const diag = JSON.parse(stderr.trim())
    expect(diag.code).toBe("E0003")
  })
})

describe("hewg summary token budget", () => {
  test("payments/refund summary is under 120 cl100k_base tokens", () => {
    const result = runSummary("payments/refund", { project: FIXTURE_TSCONFIG })
    expect(result.exitCode).toBe(0)
    const enc = getEncoding("cl100k_base")
    const tokens = enc.encode(result.stdout)
    expect(tokens.length).toBeLessThan(120)
  })
})
