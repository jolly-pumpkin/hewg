import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import { getEncoding } from "js-tiktoken"
import { runContract } from "../../src/commands/contract.ts"

const CLI_ENTRY = new URL("../../src/cli.ts", import.meta.url).pathname
const FIXTURE_DIR = resolve(import.meta.dirname, "../fixtures/contract")
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

describe("hewg contract (found + annotated)", () => {
  test("module/path::name form returns full §7.2 shape", async () => {
    const { code, stdout, stderr } = await runCli([
      "contract",
      "payments/refund::refund",
      "--project",
      FIXTURE_TSCONFIG,
    ])
    expect(code).toBe(0)
    expect(stderr.trim()).toBe("")

    const json = JSON.parse(stdout.trim())
    expect(json.symbol).toBe("payments/refund::refund")
    expect(json.signature).toContain("chargeId: string")
    expect(json.signature).toContain("amountCents: number")
    expect(json.effects).toEqual(["net.https", "fs.write", "log"])
    expect(json.caps).toEqual({
      http: { kind: "net.https", host: "api.stripe.com", port: 443 },
      fs: { kind: "fs.write", prefix: "./receipts/" },
      log: { kind: "log" },
    })
    expect(json.pre).toEqual(["amountCents > 0"])
    expect(json.post).toEqual(["!result.ok || exists_receipt_file(result.val.id)"])
    expect(json.cost).toEqual({
      tokens: 120,
      ops: "~6",
      net: "<=3",
      time: "<=5s",
    })
    expect(json.errors).toBeNull()
    expect(json.source.file).toBe("src/refund.ts")
    expect(typeof json.source.line).toBe("number")
  })

  test("file:name form resolves to the same hit", async () => {
    const { code, stdout } = await runCli([
      "contract",
      "src/refund.ts:refund",
      "--project",
      FIXTURE_TSCONFIG,
    ])
    expect(code).toBe(0)
    const json = JSON.parse(stdout.trim())
    expect(json.symbol).toBe("payments/refund::refund")
    expect(json.effects).toEqual(["net.https", "fs.write", "log"])
  })

  test("bare name resolves when unambiguous", async () => {
    const { code, stdout } = await runCli([
      "contract",
      "refund",
      "--project",
      FIXTURE_TSCONFIG,
    ])
    expect(code).toBe(0)
    const json = JSON.parse(stdout.trim())
    expect(json.symbol).toBe("payments/refund::refund")
  })
})

describe("hewg contract (found but unannotated)", () => {
  test("returns signature with null annotation fields and emits I0001", async () => {
    const { code, stdout, stderr } = await runCli([
      "contract",
      "src/bare.ts:bare",
      "--project",
      FIXTURE_TSCONFIG,
    ])
    expect(code).toBe(0)

    const json = JSON.parse(stdout.trim())
    expect(json.symbol).toBe("bare")
    expect(json.signature).toBe("(x: number) => number")
    expect(json.effects).toBeNull()
    expect(json.caps).toBeNull()
    expect(json.pre).toBeNull()
    expect(json.post).toBeNull()
    expect(json.cost).toBeNull()
    expect(json.errors).toBeNull()
    expect(json.source.file).toBe("src/bare.ts")

    const diag = JSON.parse(stderr.trim())
    expect(diag.code).toBe("I0001")
    expect(diag.severity).toBe("info")
  })
})

describe("hewg contract (not found)", () => {
  test("emits E0003 with exit 1", async () => {
    const { code, stdout, stderr } = await runCli([
      "contract",
      "nope::refund",
      "--project",
      FIXTURE_TSCONFIG,
    ])
    expect(code).toBe(1)
    expect(stdout.trim()).toBe("")
    const diag = JSON.parse(stderr.trim())
    expect(diag.code).toBe("E0003")
    expect(diag.message).toContain("nope::refund")
  })

  test("includes a 'did you mean' suggestion when close match exists", async () => {
    const { stderr } = await runCli([
      "contract",
      "payments/refund::refnud",
      "--project",
      FIXTURE_TSCONFIG,
    ])
    const diag = JSON.parse(stderr.trim())
    expect(diag.suggest).toBeDefined()
    expect(diag.suggest.length).toBeGreaterThan(0)
    expect(diag.suggest[0].insert).toBe("payments/refund::refund")
  })
})

describe("hewg contract (ambiguous)", () => {
  test("emits E0004 with candidate list and exit 1", async () => {
    const { code, stdout, stderr } = await runCli([
      "contract",
      "dup",
      "--project",
      FIXTURE_TSCONFIG,
    ])
    expect(code).toBe(1)
    expect(stdout.trim()).toBe("")
    const diag = JSON.parse(stderr.trim())
    expect(diag.code).toBe("E0004")
    expect(diag.related).toBeDefined()
    expect(diag.related.length).toBe(2)
    const labels = diag.related.map((r: { message: string }) => r.message)
    expect(labels).toContain("candidate: dup/a::dup")
    expect(labels).toContain("candidate: dup/b::dup")
  })
})

describe("hewg contract token budget", () => {
  test("refund contract is under 300 cl100k_base tokens", () => {
    const result = runContract("payments/refund::refund", {
      project: FIXTURE_TSCONFIG,
    })
    expect(result.exitCode).toBe(0)
    const enc = getEncoding("cl100k_base")
    const tokens = enc.encode(result.stdout)
    expect(tokens.length).toBeLessThan(300)
  })
})
