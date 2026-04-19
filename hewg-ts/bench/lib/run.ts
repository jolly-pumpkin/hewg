import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { isAbsolute, join, resolve } from "node:path"
import { runAgentLoop } from "./agent-loop.ts"
import type { ModelClient } from "./anthropic-client.ts"
import { createAnthropicClient } from "./anthropic-client.ts"
import { extractMetrics } from "./metrics.ts"
import { buildToolBundle, loadToolSchemas } from "./tools.ts"
import type {
  BenchConfig,
  Condition,
  RunResult,
  TaskSpec,
  TurnLog,
} from "./types.ts"
import { diffTrees, prepareWorkspace, snapshotTree } from "./workspace.ts"

/**
 * @hewg-module bench/lib/run
 */

export type RunOneOptions = {
  task: TaskSpec
  taskDir: string
  condition: Condition
  seed: number
  config: BenchConfig
  repoRoot: string
  resultsDir: string
  workspaceBase: string
  client: ModelClient
  force?: boolean
}

/**
 * @hewg-module bench/lib/run
 * @effects fs.read, fs.write, net.https, proc.spawn
 */
export async function runOne(opts: RunOneOptions): Promise<RunResult> {
  const { task, condition, seed, config } = opts
  const runDir = join(opts.resultsDir, task.id, String(condition), String(seed))
  mkdirSync(runDir, { recursive: true })
  const resultPath = join(runDir, "result.json")
  const logPath = join(runDir, "run.jsonl")
  const patchPath = join(runDir, "patch.diff")

  if (!opts.force && existsSync(resultPath)) {
    const existing = JSON.parse(readFileSync(resultPath, "utf8")) as RunResult
    return existing
  }

  const variantRel = task.conditions[String(condition)]
  if (variantRel === undefined) {
    throw new Error(`task ${task.id} has no variant for condition ${condition}`)
  }
  const variantDir = isAbsolute(variantRel) ? variantRel : resolve(opts.taskDir, variantRel)
  const testScript = isAbsolute(task.test) ? task.test : resolve(opts.taskDir, task.test)

  const workspace = join(opts.workspaceBase, `${task.id}-${condition}-${seed}`)
  prepareWorkspace(variantDir, workspace)
  const beforeTree = snapshotTree(workspace)

  const promptPath = config.prompts[String(condition)]
  if (promptPath === undefined) throw new Error(`no prompt configured for condition ${condition}`)
  const system = readFileSync(
    isAbsolute(promptPath) ? promptPath : join(opts.repoRoot, promptPath),
    "utf8",
  )
  const taskText = readFileSync(join(opts.taskDir, "README.md"), "utf8")

  const allTools = loadToolSchemas(config.tools.all, opts.repoRoot)
  const condition4Tools = loadToolSchemas(config.tools.condition4, opts.repoRoot)
  const bundle = buildToolBundle({
    workspace,
    testScript,
    condition,
    allTools,
    condition4Tools,
  })

  // Resumption: read any prior log so the loop picks up where it left off.
  const resumeFrom: TurnLog[] = existsSync(logPath)
    ? readFileSync(logPath, "utf8")
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as TurnLog)
    : []

  const startedAt = new Date().toISOString()
  const agentResult = await runAgentLoop({
    client: opts.client,
    model: config.model,
    system,
    tools: bundle,
    task: taskText,
    iterationBudget: config.iterationBudget,
    tokenBudget: config.tokenBudget,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    logPath,
    resumeFrom,
    rng: makeRng(seed),
  })
  const finishedAt = new Date().toISOString()

  // Capture the patch and run the ground-truth check.
  writeFileSync(patchPath, diffTrees(beforeTree, workspace))
  const success = runGroundTruth(workspace, testScript)
  const metric = extractMetrics(workspace, condition, beforeTree)

  const result: RunResult = {
    task: task.id,
    condition,
    seed,
    configSnapshot: config,
    startedAt,
    finishedAt,
    metrics: {
      success,
      iterations: agentResult.iterations,
      tokensInput: agentResult.tokensInput,
      tokensOutput: agentResult.tokensOutput,
      hallucinatedSymbols: metric.hallucinatedSymbols,
      effectViolations: metric.effectViolations,
      stop: agentResult.stop,
    },
    patchPath,
  }
  writeFileSync(resultPath, JSON.stringify(result, null, 2))
  return result
}

function runGroundTruth(workspace: string, testScript: string): boolean {
  const res = spawnSync("bash", [testScript], {
    cwd: workspace,
    encoding: "utf8",
    timeout: 60_000,
  })
  return res.status === 0
}

export type RunTaskOptions = {
  taskDir: string
  configPath: string
  repoRoot: string
  resultsDir: string
  workspaceBase: string
  conditions?: Condition[]
  seeds?: number[]
  force?: boolean
  client?: ModelClient
}

/**
 * @hewg-module bench/lib/run
 * @effects fs.read, fs.write, net.https, proc.spawn
 */
export async function runTask(opts: RunTaskOptions): Promise<RunResult[]> {
  const config = readConfig(opts.configPath)
  const task = readTask(opts.taskDir)
  const conditions = opts.conditions ?? ([1, 2, 3, 4] as Condition[])
  const seeds = opts.seeds ?? config.seeds.slice(0, config.repetitions)
  const client = opts.client ?? defaultClient(config)

  const out: RunResult[] = []
  for (const cond of conditions) {
    for (const seed of seeds) {
      const result = await runOne({
        task,
        taskDir: opts.taskDir,
        condition: cond,
        seed,
        config,
        repoRoot: opts.repoRoot,
        resultsDir: opts.resultsDir,
        workspaceBase: opts.workspaceBase,
        client,
        force: opts.force,
      })
      out.push(result)
    }
  }
  return out
}

/**
 * @hewg-module bench/lib/run
 * @effects fs.read
 */
export function readConfig(path: string): BenchConfig {
  return JSON.parse(readFileSync(path, "utf8")) as BenchConfig
}

/**
 * @hewg-module bench/lib/run
 * @effects fs.read
 */
export function readTask(taskDir: string): TaskSpec {
  return JSON.parse(readFileSync(join(taskDir, "task.json"), "utf8")) as TaskSpec
}

function defaultClient(config: BenchConfig): ModelClient {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey === undefined || apiKey === "") {
    throw new Error("ANTHROPIC_API_KEY is not set; either set it or pass a stub client to runTask()")
  }
  return createAnthropicClient(apiKey, config.retry)
}

function makeRng(seed: number): () => number {
  // Deterministic mulberry32.
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
