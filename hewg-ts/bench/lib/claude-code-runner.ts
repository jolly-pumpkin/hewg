import { spawn, spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { join, resolve } from "node:path"
import type { Condition, TaskSpec } from "./types.ts"
import { prepareWorkspace, snapshotTree, diffTrees } from "./workspace.ts"
import { extractMetrics } from "./metrics.ts"

/**
 * @hewg-module bench/lib/claude-code-runner
 */

export type ClaudeCodeRunOptions = {
  task: TaskSpec
  taskDir: string
  condition: Condition
  seed: number
  repoRoot: string
  resultsDir: string
  workspaceBase: string
  model?: string
  maxBudgetUsd?: number
  permissionMode?: "bypassPermissions" | "default"
  systemPromptFile?: string
  force?: boolean
  live?: boolean
}

export type ClaudeCodeRunResult = {
  task: string
  condition: Condition
  seed: number
  success: boolean
  durationMs: number
  costUsd: number | null
  numTurns: number | null
  stopReason: string | null
  rawOutput: string
}

/**
 * Run a benchmark task using Claude Code in headless mode (claude -p).
 *
 * This bypasses the custom agent loop entirely — Claude Code manages its own
 * tool use, system prompt, and iteration. We just:
 * 1. Copy the condition workspace
 * 2. Run `claude -p` with the task README as prompt
 * 3. Run test.sh to check success
 *
 * @effects proc.spawn, fs.read, fs.write
 */
export async function runWithClaudeCode(opts: ClaudeCodeRunOptions): Promise<ClaudeCodeRunResult> {
  const { task, condition, seed } = opts
  const runDir = join(opts.resultsDir, task.id, `cc-${condition}`, String(seed))
  mkdirSync(runDir, { recursive: true })
  const resultPath = join(runDir, "result.json")

  if (!opts.force && existsSync(resultPath)) {
    return JSON.parse(readFileSync(resultPath, "utf8")) as ClaudeCodeRunResult
  }

  // Prepare workspace
  const variantRel = task.conditions[String(condition)]
  if (variantRel === undefined) {
    throw new Error(`task ${task.id} has no variant for condition ${condition}`)
  }
  const variantDir = resolve(opts.taskDir, variantRel)
  const workspace = join(opts.workspaceBase, `cc-${task.id}-${condition}-${seed}`)
  prepareWorkspace(variantDir, workspace)
  const beforeTree = snapshotTree(workspace)

  // Copy test.sh into workspace so claude can run it
  const testScript = resolve(opts.taskDir, task.test)
  const workspaceTestScript = join(workspace, "test.sh")
  writeFileSync(workspaceTestScript, readFileSync(testScript, "utf8"), { mode: 0o755 })

  // Read task prompt
  const taskText = readFileSync(join(opts.taskDir, "README.md"), "utf8")

  // Build claude command.
  // We don't use --bare because that requires ANTHROPIC_API_KEY in env
  // (it skips keychain/OAuth). Instead we use targeted flags.
  const args: string[] = [
    "-p", taskText,
    "--output-format", "json",
    "--permission-mode", opts.permissionMode ?? "bypassPermissions",
  ]

  if (opts.model) {
    args.push("--model", opts.model)
  }
  if (opts.maxBudgetUsd) {
    args.push("--max-budget-usd", String(opts.maxBudgetUsd))
  }
  if (opts.systemPromptFile) {
    args.push("--system-prompt", readFileSync(opts.systemPromptFile, "utf8"))
  }

  // Tell Claude Code how to verify completion
  args.push(
    "--append-system-prompt",
    "To verify your work is complete, run: bash test.sh — exit code 0 means success. Reply with DONE when tests pass.",
  )

  // Constrain tools to file operations and bash (for run_tests equivalent)
  args.push("--tools", "Bash,Read,Edit,Write,Glob,Grep")

  const startMs = Date.now()
  const live = opts.live ?? false

  const rawOutput = await new Promise<string>((resolve, reject) => {
    const child = spawn("claude", args, {
      cwd: workspace,
      env: process.env as Record<string, string>,
      stdio: ["ignore", "pipe", live ? "pipe" : "ignore"],
    })

    const chunks: Buffer[] = []
    child.stdout!.on("data", (chunk: Buffer) => chunks.push(chunk))

    if (live && child.stderr) {
      child.stderr.pipe(process.stderr)
    }

    const timer = setTimeout(() => {
      child.kill("SIGTERM")
    }, 600_000)

    child.on("close", () => {
      clearTimeout(timer)
      resolve(Buffer.concat(chunks).toString("utf8"))
    })
    child.on("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })

  const durationMs = Date.now() - startMs

  // Parse output
  let costUsd: number | null = null
  let numTurns: number | null = null
  let stopReason: string | null = null

  try {
    const json = JSON.parse(rawOutput) as {
      total_cost_usd?: number
      num_turns?: number
      stop_reason?: string
      result?: string
    }
    costUsd = json.total_cost_usd ?? null
    numTurns = json.num_turns ?? null
    stopReason = json.stop_reason ?? null
  } catch {
    // output wasn't valid JSON — might have errored
  }

  // Save the raw output and patch
  writeFileSync(join(runDir, "claude-output.json"), rawOutput)
  writeFileSync(join(runDir, "patch.diff"), diffTrees(beforeTree, workspace))

  // Run ground-truth test (reuse testScript from above)
  const testRes = spawnSync("bash", [testScript], {
    cwd: workspace,
    encoding: "utf8",
    timeout: 60_000,
  })
  const success = testRes.status === 0

  const result: ClaudeCodeRunResult = {
    task: task.id,
    condition,
    seed,
    success,
    durationMs,
    costUsd,
    numTurns,
    stopReason,
    rawOutput,
  }

  writeFileSync(resultPath, JSON.stringify(result, null, 2))
  return result
}
