import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import type { ModelClient, ModelRequest, ModelResponse } from "../../bench/lib/anthropic-client.ts"
import { aggregate, loadResults, renderMarkdown } from "../../bench/lib/report.ts"
import { runTask } from "../../bench/lib/run.ts"
import type { Condition } from "../../bench/lib/types.ts"

const REPO_ROOT = resolve(import.meta.dirname, "../..")
const CONFIG_PATH = join(REPO_ROOT, "bench/config.json")
const TASK_DIR = join(REPO_ROOT, "bench/tasks/smoke")

type PlannedCall =
  | { tool: "read_file"; path: string }
  | { tool: "edit_file"; path: string; old: string; new: string }
  | { tool: "run_tests" }
  | { tool: "hewg_check" }
  | { tool: "hewg_contract"; symbol: string }

type PlannedTurn =
  | { kind: "tool"; call: PlannedCall }
  | { kind: "done"; text: string }

function scriptFor(condition: Condition): PlannedTurn[] {
  // Same plan across conditions: read the file, edit in the comment, run tests, say DONE.
  return [
    { kind: "tool", call: { tool: "read_file", path: "src/greet.ts" } },
    {
      kind: "tool",
      call: {
        tool: "edit_file",
        path: "src/greet.ts",
        // The edit_file tool expects an `old_string` that is unique and present.
        // All three variants contain `export function greet` on its own line.
        old: "export function greet(name: string): string {",
        new: "/** Greets the named user. */\nexport function greet(name: string): string {",
      },
    },
    { kind: "tool", call: { tool: "run_tests" } },
    { kind: "done", text: "DONE" },
  ]
}

function stubClient(script: PlannedTurn[]): ModelClient {
  let idx = 0
  return {
    async send(_req: ModelRequest): Promise<ModelResponse> {
      if (idx >= script.length) {
        return {
          content: [{ type: "text", text: "DONE" }],
          stopReason: "end_turn",
          usage: { input: 10, output: 2 },
        }
      }
      const step = script[idx]!
      idx += 1
      if (step.kind === "done") {
        return {
          content: [{ type: "text", text: step.text }],
          stopReason: "end_turn",
          usage: { input: 20, output: 4 },
        }
      }
      const call = step.call
      const id = `toolu_${idx}`
      let input: Record<string, unknown>
      switch (call.tool) {
        case "read_file":
          input = { path: call.path }
          break
        case "edit_file":
          input = { path: call.path, old_string: call.old, new_string: call.new }
          break
        case "run_tests":
          input = {}
          break
        case "hewg_check":
          input = {}
          break
        case "hewg_contract":
          input = { symbol: call.symbol }
          break
      }
      return {
        content: [{ type: "tool_use", id, name: call.tool, input }],
        stopReason: "tool_use",
        usage: { input: 30, output: 8 },
      }
    },
  }
}

describe("harness (stub model, smoke task)", () => {
  test("runs all four conditions × 1 seed and produces well-formed results", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "hewg-bench-test-"))
    const resultsDir = join(scratch, "results")
    const workspaceBase = join(scratch, "ws")

    for (const condition of [1, 2, 3, 4] as Condition[]) {
      const results = await runTask({
        taskDir: TASK_DIR,
        configPath: CONFIG_PATH,
        repoRoot: REPO_ROOT,
        resultsDir,
        workspaceBase,
        conditions: [condition],
        seeds: [42],
        client: stubClient(scriptFor(condition)),
      })
      expect(results.length).toBe(1)
      const r = results[0]!
      expect(r.task).toBe("smoke")
      expect(r.condition).toBe(condition)
      expect(r.seed).toBe(42)
      expect(r.metrics.success).toBe(true)
      expect(r.metrics.iterations).toBeGreaterThan(0)
      expect(r.metrics.stop).toBe("done")
      expect(r.metrics.hallucinatedSymbols).toBe(0)
      if (condition === 3 || condition === 4) {
        expect(r.metrics.effectViolations).not.toBeNull()
      } else {
        expect(r.metrics.effectViolations).toBeNull()
      }
      expect(existsSync(r.patchPath)).toBe(true)
    }

    // Report generation.
    const results = loadResults(resultsDir, ["smoke"])
    expect(results.length).toBe(4)
    const rows = aggregate(results)
    expect(rows.length).toBe(4)
    const md = renderMarkdown(rows)
    expect(md).toContain("# Hewg benchmark report")
    expect(md).toContain("Task: `smoke`")
    expect(md).toContain("1 (plain TS)")
    expect(md).toContain("4 (+Hewg + tools)")
  })

  test("result.json is a complete snapshot of config + metrics", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "hewg-bench-snap-"))
    const results = await runTask({
      taskDir: TASK_DIR,
      configPath: CONFIG_PATH,
      repoRoot: REPO_ROOT,
      resultsDir: join(scratch, "results"),
      workspaceBase: join(scratch, "ws"),
      conditions: [1],
      seeds: [1],
      client: stubClient(scriptFor(1)),
    })
    const r = results[0]!
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"))
    expect(r.configSnapshot.model).toBe(config.model)
    expect(r.configSnapshot.iterationBudget).toBe(config.iterationBudget)
    expect(r.startedAt.length).toBeGreaterThan(10)
    expect(r.finishedAt.length).toBeGreaterThan(10)
  })

  test("existing result.json short-circuits without re-running", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "hewg-bench-skip-"))
    const resultsDir = join(scratch, "results")
    const workspaceBase = join(scratch, "ws")
    // First run: stub that completes.
    const first = await runTask({
      taskDir: TASK_DIR,
      configPath: CONFIG_PATH,
      repoRoot: REPO_ROOT,
      resultsDir,
      workspaceBase,
      conditions: [1],
      seeds: [7],
      client: stubClient(scriptFor(1)),
    })
    expect(first[0]!.metrics.success).toBe(true)

    // Second run: client that would blow up if called; must be skipped.
    const blowUp: ModelClient = {
      async send() { throw new Error("should not be called") },
    }
    const second = await runTask({
      taskDir: TASK_DIR,
      configPath: CONFIG_PATH,
      repoRoot: REPO_ROOT,
      resultsDir,
      workspaceBase,
      conditions: [1],
      seeds: [7],
      client: blowUp,
    })
    expect(second[0]!.metrics.success).toBe(true)
    expect(second[0]!.startedAt).toBe(first[0]!.startedAt)
  })
})

describe("smoke task fixtures", () => {
  test("test.sh is executable and exists for each condition variant", () => {
    for (const cond of ["1", "2", "3-4"]) {
      const variant = join(TASK_DIR, "conditions", cond, "src/greet.ts")
      expect(existsSync(variant)).toBe(true)
      const contents = readFileSync(variant, "utf8")
      expect(contents).toContain("export function greet")
    }
    expect(existsSync(join(TASK_DIR, "test.sh"))).toBe(true)
    expect(existsSync(join(TASK_DIR, "task.json"))).toBe(true)
  })

  test("task.json matches condition directories", () => {
    const spec = JSON.parse(readFileSync(join(TASK_DIR, "task.json"), "utf8"))
    expect(Object.keys(spec.conditions)).toEqual(["1", "2", "3", "4"])
    for (const rel of Object.values<string>(spec.conditions)) {
      expect(existsSync(join(TASK_DIR, rel))).toBe(true)
    }
  })
})
