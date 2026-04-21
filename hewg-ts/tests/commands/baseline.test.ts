import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { BASELINE_FILENAME, type BaselineSchema } from "../../src/baseline.ts"
import { runBaseline } from "../../src/commands/baseline.ts"
import { runCheck } from "../../src/commands/check.ts"

const FIXTURE_DIR = resolve(import.meta.dirname, "../fixtures/check")
const FIXTURE_TSCONFIG = resolve(FIXTURE_DIR, "tsconfig.json")
const BASELINE_PATH = resolve(FIXTURE_DIR, BASELINE_FILENAME)

afterEach(() => {
  // Clean up baseline file after each test
  try {
    unlinkSync(BASELINE_PATH)
  } catch {
    // ignore if not exists
  }
})

describe("hewg baseline update", () => {
  test("writes a valid baseline file", () => {
    const result = runBaseline({ subcommand: "update", project: FIXTURE_TSCONFIG })
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Baselined")

    expect(existsSync(BASELINE_PATH)).toBe(true)
    const content = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as BaselineSchema
    expect(content.version).toBe(1)
    expect(content.hewgVersion).toBeDefined()
    expect(content.count).toBeGreaterThan(0)
    expect(Object.keys(content.entries).length).toBeGreaterThan(0)
  })

  test("baseline count matches diagnostic count", () => {
    // Run check to see how many diagnostics exist
    const checkResult = runCheck({ project: FIXTURE_TSCONFIG, format: "json", noBaseline: true })
    const diagCount = checkResult.stdout.trim().split("\n").length

    runBaseline({ subcommand: "update", project: FIXTURE_TSCONFIG })
    const content = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as BaselineSchema
    expect(content.count).toBe(diagCount)
  })

  test("strict mode blocks update when violations increase", () => {
    // Create an initial baseline with fewer entries than current violations
    const smallBaseline: BaselineSchema = {
      version: 1,
      hewgVersion: "0.0.1",
      generatedAt: "2026-04-20T00:00:00.000Z",
      count: 1,
      entries: { "E0301::src/audit.ts::something": 1 },
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(smallBaseline, null, 2))

    // Write a config with strict mode
    const configPath = resolve(FIXTURE_DIR, "hewg.config.json")
    const origConfig = existsSync(configPath) ? readFileSync(configPath, "utf8") : null
    writeFileSync(configPath, JSON.stringify({ baseline: { strict: true } }))

    try {
      const result = runBaseline({ subcommand: "update", project: FIXTURE_TSCONFIG })
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("strict mode")
    } finally {
      // Restore original config
      if (origConfig) {
        writeFileSync(configPath, origConfig)
      } else {
        try { unlinkSync(configPath) } catch { /* ignore */ }
      }
    }
  })
})

describe("hewg baseline status", () => {
  test("fails when no baseline exists", () => {
    const result = runBaseline({ subcommand: "status", project: FIXTURE_TSCONFIG })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("no baseline file found")
  })

  test("reports correct counts after baseline update", () => {
    // Create baseline
    runBaseline({ subcommand: "update", project: FIXTURE_TSCONFIG })

    // Status should show 0 new
    const result = runBaseline({ subcommand: "status", project: FIXTURE_TSCONFIG })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("New:       0")
    expect(result.stdout).toContain("Fixed:     0")
  })
})

describe("hewg check with baseline", () => {
  test("exits 0 when all violations are baselined", () => {
    // Create baseline first
    runBaseline({ subcommand: "update", project: FIXTURE_TSCONFIG })

    // Now check should pass
    const result = runCheck({ project: FIXTURE_TSCONFIG, format: "json" })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe("")
  })

  test("--no-baseline shows all violations regardless", () => {
    // Create baseline first
    runBaseline({ subcommand: "update", project: FIXTURE_TSCONFIG })

    // Check with no-baseline should still fail
    const result = runCheck({ project: FIXTURE_TSCONFIG, format: "json", noBaseline: true })
    expect(result.exitCode).toBe(1)
    expect(result.stdout.trim().length).toBeGreaterThan(0)
  })

  test("new violations not in baseline cause failure", () => {
    // Create a baseline that only covers some violations
    const partialBaseline: BaselineSchema = {
      version: 1,
      hewgVersion: "0.0.1",
      generatedAt: "2026-04-20T00:00:00.000Z",
      count: 1,
      entries: {
        // Only baseline one of the audit.ts violations
        "E0301::src/audit.ts::call to `fs.readFile` performs effect `fs.read`, not declared in @effects `log`": 1,
      },
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(partialBaseline, null, 2))

    // Check should fail because other violations are not baselined
    const result = runCheck({ project: FIXTURE_TSCONFIG, format: "json" })
    expect(result.exitCode).toBe(1)
  })
})
