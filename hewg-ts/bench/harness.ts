import { existsSync, readdirSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { cac } from "cac"
import { readConfig, readTask, runTask } from "./lib/run.ts"
import { createOllamaClient } from "./lib/ollama-client.ts"
import { createAnthropicClient } from "./lib/anthropic-client.ts"
import type { ModelClient } from "./lib/anthropic-client.ts"
import type { Condition, BenchConfig } from "./lib/types.ts"

/**
 * @hewg-module bench/harness
 */

const DEFAULT_CONFIG = "bench/config.json"
const DEFAULT_TASK_ROOT = "bench/tasks"
const DEFAULT_RESULTS = "bench/results"
const DEFAULT_WORKSPACE_BASE = "/tmp/hewg-bench"

const cli = cac("hewg-bench")

cli
  .command("run", "Run one or more (task, condition, seed) combinations")
  .option("--task <id>", "Task id (directory name under bench/tasks)")
  .option("--config <path>", "Path to bench/config.json", { default: DEFAULT_CONFIG })
  .option("--tasks-root <path>", "Root of task directories", { default: DEFAULT_TASK_ROOT })
  .option("--results-dir <path>", "Where to write results", { default: DEFAULT_RESULTS })
  .option("--workspace <path>", "Scratch workspace base dir", { default: DEFAULT_WORKSPACE_BASE })
  .option("--condition <n>", "Restrict to one condition (1..4)")
  .option("--seed <n>", "Restrict to one seed")
  .option("--all", "Run every condition × every seed from config")
  .option("--repeat <n>", "Override repetitions (picks first N seeds)")
  .option("--force", "Re-run even if result.json already exists")
  .option("--ollama [url]", "Use local Ollama (default http://localhost:11434)")
  .option("--model <name>", "Override model name from config (e.g. gemma4:27b)")
  .option("--live", "Show live log trail of agent activity (default: true if TTY)")
  .option("--verbose", "Show full agent text in live log (default: truncated)")
  .action(async (options) => {
    const repoRoot = findRepoRoot()
    const taskId = String(options.task ?? "")
    if (taskId === "") {
      console.error("--task is required")
      process.exit(2)
    }
    const configPath = resolvePath(options.config ?? DEFAULT_CONFIG, repoRoot)
    const tasksRoot = resolvePath(options["tasksRoot"] ?? DEFAULT_TASK_ROOT, repoRoot)
    const taskDir = join(tasksRoot, taskId)
    if (!existsSync(taskDir)) {
      console.error(`task directory not found: ${taskDir}`)
      process.exit(2)
    }
    const resultsDir = resolvePath(options["resultsDir"] ?? DEFAULT_RESULTS, repoRoot)
    const workspaceBase = resolvePath(options.workspace ?? DEFAULT_WORKSPACE_BASE, repoRoot)

    const conditions: Condition[] = options.condition !== undefined
      ? [Number(options.condition) as Condition]
      : [1, 2, 3, 4]

    const config = readConfig(configPath)
    let seeds: number[]
    if (options.seed !== undefined) {
      seeds = [Number(options.seed)]
    } else if (options.repeat !== undefined) {
      seeds = config.seeds.slice(0, Number(options.repeat))
    } else {
      seeds = config.seeds.slice(0, config.repetitions)
    }

    if (!options.all && options.condition === undefined && options.seed === undefined && options.repeat === undefined) {
      // Default to all conditions × configured repetitions. (Same as --all.)
    }

    // Build model client: Ollama or Anthropic
    const client = buildClient(options, config)
    const modelOverride = options.model ? String(options.model) : undefined

    const live = options.live !== undefined ? Boolean(options.live) : process.stderr.isTTY === true
    const verbose = Boolean(options.verbose)

    const results = await runTask({
      taskDir,
      configPath,
      repoRoot,
      resultsDir,
      workspaceBase,
      conditions,
      seeds,
      force: Boolean(options.force),
      client,
      modelOverride,
      live,
      verbose,
    })

    for (const r of results) {
      const outcome = r.metrics.success ? "PASS" : "FAIL"
      console.log(
        `[${outcome}] task=${r.task} cond=${r.condition} seed=${r.seed} iters=${r.metrics.iterations} tok=${r.metrics.tokensInput + r.metrics.tokensOutput} stop=${r.metrics.stop}`,
      )
    }
  })

cli
  .command("run-cc", "Run task(s) using Claude Code headless (claude -p)")
  .option("--task <id>", "Task id (directory name under bench/tasks)")
  .option("--tasks-root <path>", "Root of task directories", { default: DEFAULT_TASK_ROOT })
  .option("--results-dir <path>", "Where to write results", { default: DEFAULT_RESULTS })
  .option("--workspace <path>", "Scratch workspace base dir", { default: DEFAULT_WORKSPACE_BASE })
  .option("--condition <n>", "Restrict to one condition (1..4)")
  .option("--seed <n>", "Restrict to one seed", { default: "1" })
  .option("--model <name>", "Model to use (e.g. opus, sonnet, haiku)")
  .option("--max-budget <usd>", "Max budget per run in USD", { default: "1.0" })
  .option("--system-prompt-file <path>", "Custom system prompt file for the condition")
  .option("--force", "Re-run even if result.json already exists")
  .option("--live", "Pipe Claude Code stderr to terminal for live output (default: true if TTY)")
  .action(async (options) => {
    const { runWithClaudeCode } = await import("./lib/claude-code-runner.ts")
    const repoRoot = findRepoRoot()
    const taskId = String(options.task ?? "")
    if (taskId === "") {
      console.error("--task is required")
      process.exit(2)
    }
    const tasksRoot = resolvePath(options["tasksRoot"] ?? DEFAULT_TASK_ROOT, repoRoot)
    const taskDir = join(tasksRoot, taskId)
    if (!existsSync(taskDir)) {
      console.error(`task directory not found: ${taskDir}`)
      process.exit(2)
    }
    const resultsDir = resolvePath(options["resultsDir"] ?? DEFAULT_RESULTS, repoRoot)
    const workspaceBase = resolvePath(options.workspace ?? DEFAULT_WORKSPACE_BASE, repoRoot)

    const task = readTask(taskDir)
    const conditions: Condition[] = options.condition !== undefined
      ? [Number(options.condition) as Condition]
      : [1, 2, 3, 4]
    const seed = Number(options.seed ?? 1)

    const live = options.live !== undefined ? Boolean(options.live) : process.stderr.isTTY === true

    for (const cond of conditions) {
      const result = await runWithClaudeCode({
        task,
        taskDir,
        condition: cond,
        seed,
        repoRoot,
        resultsDir,
        workspaceBase,
        model: options.model ? String(options.model) : undefined,
        maxBudgetUsd: Number(options["maxBudget"] ?? 1.0),
        systemPromptFile: options["systemPromptFile"] ? String(options["systemPromptFile"]) : undefined,
        force: Boolean(options.force),
        live,
      })
      const outcome = result.success ? "PASS" : "FAIL"
      const cost = result.costUsd !== null ? `$${result.costUsd.toFixed(4)}` : "?"
      console.log(
        `[${outcome}] task=${result.task} cond=${result.condition} seed=${result.seed} turns=${result.numTurns ?? "?"} cost=${cost} time=${(result.durationMs / 1000).toFixed(1)}s`,
      )
    }
  })

cli
  .command("status", "List which (task, condition, seed) runs exist")
  .option("--task <id>", "Task id")
  .option("--results-dir <path>", "Where results live", { default: DEFAULT_RESULTS })
  .option("--tasks-root <path>", "Root of task directories", { default: DEFAULT_TASK_ROOT })
  .option("--config <path>", "Path to bench/config.json", { default: DEFAULT_CONFIG })
  .action((options) => {
    const repoRoot = findRepoRoot()
    const resultsDir = resolvePath(options["resultsDir"] ?? DEFAULT_RESULTS, repoRoot)
    const tasksRoot = resolvePath(options["tasksRoot"] ?? DEFAULT_TASK_ROOT, repoRoot)
    const configPath = resolvePath(options.config ?? DEFAULT_CONFIG, repoRoot)
    const config = readConfig(configPath)

    const taskIds = options.task !== undefined ? [String(options.task)] : listTasks(tasksRoot)
    for (const id of taskIds) {
      const taskDir = join(tasksRoot, id)
      if (!existsSync(taskDir)) continue
      const task = readTask(taskDir)
      console.log(`task ${task.id}`)
      for (const cond of [1, 2, 3, 4]) {
        for (const seed of config.seeds.slice(0, config.repetitions)) {
          const p = join(resultsDir, task.id, String(cond), String(seed), "result.json")
          const mark = existsSync(p) ? "✓" : "·"
          console.log(`  ${mark} cond=${cond} seed=${seed}`)
        }
      }
    }
  })

cli.help()

const parsed = cli.parse(process.argv, { run: false })
if (parsed.options.help || parsed.options.version) {
  // cac handled output.
} else if (!cli.matchedCommand) {
  cli.outputHelp()
} else {
  await cli.runMatchedCommand()
}

function findRepoRoot(): string {
  let dir = process.cwd()
  while (true) {
    if (existsSync(join(dir, "bench/config.json"))) return dir
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "bench"))) return dir
    const parent = dirname(dir)
    if (parent === dir) return process.cwd()
    dir = parent
  }
}

function resolvePath(p: string, repoRoot: string): string {
  return isAbsolute(p) ? p : resolve(repoRoot, p)
}

function listTasks(tasksRoot: string): string[] {
  if (!existsSync(tasksRoot)) return []
  return readdirSync(tasksRoot).filter((e) => existsSync(join(tasksRoot, e, "task.json")))
}

function buildClient(options: Record<string, unknown>, config: BenchConfig): ModelClient {
  if (options.ollama !== undefined) {
    const baseUrl = typeof options.ollama === "string" && options.ollama !== ""
      ? options.ollama
      : "http://localhost:11434"
    return createOllamaClient({ baseUrl })
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey === undefined || apiKey === "") {
    console.error("ANTHROPIC_API_KEY is not set. Use --ollama for local models.")
    process.exit(2)
  }
  return createAnthropicClient(apiKey, config.retry)
}
