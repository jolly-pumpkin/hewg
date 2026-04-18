import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runInit } from "../../src/commands/init.ts"

let tmp: string

function setupProject(dir: string): void {
  mkdirSync(join(dir, "src"), { recursive: true })
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { strict: true, target: "ES2022", module: "ESNext" },
      include: ["src/**/*"],
    }),
    "utf8",
  )
  writeFileSync(join(dir, "src", "a.ts"), "export const x = 1\n", "utf8")
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "hewg-init-"))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("hewg init (happy path)", () => {
  test("writes default hewg.config.json and leaves source files untouched", () => {
    setupProject(tmp)
    const srcBefore = readFileSync(join(tmp, "src", "a.ts"))

    const result = runInit({ path: tmp, cwd: tmp })
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("wrote")
    expect(result.stdout).toContain("hewg.config.json")

    const cfgPath = join(tmp, "hewg.config.json")
    expect(existsSync(cfgPath)).toBe(true)
    const raw = readFileSync(cfgPath, "utf8")
    expect(raw.endsWith("\n")).toBe(true)
    const parsed = JSON.parse(raw)
    expect(parsed).toEqual({
      check: { depthLimit: 10, unknownEffectPolicy: "warn" },
    })

    const srcAfter = readFileSync(join(tmp, "src", "a.ts"))
    expect(Buffer.compare(srcBefore, srcAfter)).toBe(0)
  })
})

describe("hewg init (config already exists)", () => {
  test("emits E0005 and does not overwrite", () => {
    setupProject(tmp)
    const first = runInit({ path: tmp, cwd: tmp })
    expect(first.exitCode).toBe(0)
    const cfgPath = join(tmp, "hewg.config.json")
    const writtenBytes = readFileSync(cfgPath)

    const second = runInit({ path: tmp, cwd: tmp })
    expect(second.exitCode).toBe(1)
    expect(second.stdout).toBe("")
    const diag = JSON.parse(second.stderr.trim())
    expect(diag.code).toBe("E0005")
    expect(diag.severity).toBe("error")

    const bytesAfter = readFileSync(cfgPath)
    expect(Buffer.compare(writtenBytes, bytesAfter)).toBe(0)
  })
})

describe("hewg init (no tsconfig)", () => {
  test("emits E0001 with exit 1", () => {
    const result = runInit({ path: tmp, cwd: tmp })
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    const diag = JSON.parse(result.stderr.trim())
    expect(diag.code).toBe("E0001")
  })
})
