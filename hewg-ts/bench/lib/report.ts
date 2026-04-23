import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import type { Condition, RunResult } from "./types.ts"

/**
 * @hewg-module bench/lib/report
 */

export type Aggregate = {
  task: string
  condition: Condition
  n: number
  successRate: number
  successRateCi: [number, number]
  meanIterations: number
  meanIterationsCi: [number, number]
  meanTokens: number
  meanTokensCi: [number, number]
  meanHallucinations: number | null
  meanEffectViolations: number | null
  meanFilesReadBeforeFirstCorrectEdit: number | null
  meanBacktrackingEvents: number | null
}

/**
 * @hewg-module bench/lib/report
 * @effects fs.read
 */
export function loadResults(resultsDir: string, taskFilter?: string[]): RunResult[] {
  if (!existsSync(resultsDir)) return []
  const out: RunResult[] = []
  for (const taskId of readdirSync(resultsDir)) {
    if (taskFilter !== undefined && !taskFilter.includes(taskId)) continue
    const taskDir = join(resultsDir, taskId)
    if (!isDir(taskDir)) continue
    for (const cond of readdirSync(taskDir)) {
      const condDir = join(taskDir, cond)
      if (!isDir(condDir)) continue
      for (const seed of readdirSync(condDir)) {
        const seedDir = join(condDir, seed)
        if (!isDir(seedDir)) continue
        const p = join(seedDir, "result.json")
        if (!existsSync(p)) continue
        try {
          out.push(JSON.parse(readFileSync(p, "utf8")) as RunResult)
        } catch {
          // skip malformed
        }
      }
    }
  }
  return out
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

export function aggregate(results: RunResult[]): Aggregate[] {
  const groups = new Map<string, RunResult[]>()
  for (const r of results) {
    const key = `${r.task}::${r.condition}`
    let arr = groups.get(key)
    if (arr === undefined) {
      arr = []
      groups.set(key, arr)
    }
    arr.push(r)
  }
  const out: Aggregate[] = []
  for (const [key, runs] of [...groups.entries()].sort()) {
    const [task, condStr] = key.split("::")
    const condition = Number(condStr) as Condition
    const success = runs.map((r) => (r.metrics.success ? 1 : 0))
    const iter = runs.map((r) => r.metrics.iterations)
    const toks = runs.map((r) => r.metrics.tokensInput + r.metrics.tokensOutput)
    const halls = runs
      .map((r) => r.metrics.hallucinatedSymbols)
      .filter((v): v is number => v !== null)
    const effViols = runs
      .map((r) => r.metrics.effectViolations)
      .filter((v): v is number => v !== null)
    const filesRead = runs
      .map((r) => r.metrics.filesReadBeforeFirstCorrectEdit)
      .filter((v): v is number => v !== null)
    const backtrack = runs
      .map((r) => r.metrics.backtrackingEvents)
      .filter((v): v is number => v !== null)

    out.push({
      task: task!,
      condition,
      n: runs.length,
      successRate: mean(success),
      successRateCi: ci95(success),
      meanIterations: mean(iter),
      meanIterationsCi: ci95(iter),
      meanTokens: mean(toks),
      meanTokensCi: ci95(toks),
      meanHallucinations: halls.length === 0 ? null : mean(halls),
      meanEffectViolations: effViols.length === 0 ? null : mean(effViols),
      meanFilesReadBeforeFirstCorrectEdit: filesRead.length === 0 ? null : mean(filesRead),
      meanBacktrackingEvents: backtrack.length === 0 ? null : mean(backtrack),
    })
  }
  return out
}

/**
 * @hewg-module bench/lib/report
 * @effects fs.read
 */
export function renderMarkdown(rows: Aggregate[], annotationCostPath?: string): string {
  if (rows.length === 0) return "# Hewg benchmark report\n\nNo results yet.\n"

  const byTask = new Map<string, Aggregate[]>()
  for (const r of rows) {
    let arr = byTask.get(r.task)
    if (arr === undefined) {
      arr = []
      byTask.set(r.task, arr)
    }
    arr.push(r)
  }

  const parts: string[] = []
  parts.push("# Hewg benchmark report")
  parts.push("")
  parts.push("Primary metrics per Design.md §9.4. Mean values with 95% CI from t-approx.")
  parts.push("")

  for (const [task, taskRows] of [...byTask.entries()].sort()) {
    parts.push(`## Task: \`${task}\``)
    parts.push("")
    parts.push("| Condition | N | Success | Iters | Tokens | Hallucinated | Effect-viol | Reads→1st edit | Backtracks |")
    parts.push("|-----------|---|---------|-------|--------|--------------|-------------|----------------|------------|")
    for (const r of taskRows.sort((a, b) => a.condition - b.condition)) {
      parts.push(
        `| ${conditionLabel(r.condition)} | ${r.n} | ${pct(r.successRate)} ${rangePct(r.successRateCi)} | ${num(r.meanIterations)} ${rangeNum(r.meanIterationsCi)} | ${num(r.meanTokens)} ${rangeNum(r.meanTokensCi)} | ${nullNum(r.meanHallucinations)} | ${nullNum(r.meanEffectViolations)} | ${nullNum(r.meanFilesReadBeforeFirstCorrectEdit)} | ${nullNum(r.meanBacktrackingEvents)} |`,
      )
    }
    parts.push("")
  }

  parts.push("## Cost metrics")
  parts.push("")
  if (annotationCostPath !== undefined && existsSync(annotationCostPath)) {
    parts.push("### Annotation cost (from `bench/annotation-cost.md`)")
    parts.push("")
    parts.push("```")
    parts.push(readFileSync(annotationCostPath, "utf8").trim())
    parts.push("```")
  } else {
    parts.push("Annotation cost and maintenance burden are measured during task-corpus")
    parts.push("construction (Epic 10). They will be reported here once")
    parts.push("`bench/annotation-cost.md` is populated.")
  }
  parts.push("")
  return parts.join("\n")
}

function conditionLabel(c: Condition): string {
  switch (c) {
    case 1: return "1 (plain TS)"
    case 2: return "2 (+JSDoc types)"
    case 2.5: return "2.5 (+JSDoc+arch doc)"
    case 3: return "3 (+Hewg no tool)"
    case 4: return "4 (+Hewg + tools)"
  }
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}

function stddev(xs: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const m = mean(xs)
  let s = 0
  for (const x of xs) s += (x - m) * (x - m)
  return Math.sqrt(s / (n - 1))
}

function ci95(xs: number[]): [number, number] {
  const n = xs.length
  if (n === 0) return [0, 0]
  const m = mean(xs)
  if (n < 2) return [m, m]
  // t-approx: for very small n, 1.96 under-covers. Use 2.776 for n=5, etc.
  // Epic 9 is fine with a rough Gaussian interval; tasks at n>=3 yield a
  // conservative-enough band.
  const se = stddev(xs) / Math.sqrt(n)
  const z = tCritical(n - 1)
  return [m - z * se, m + z * se]
}

function tCritical(df: number): number {
  // 95% two-sided critical values for small df. Fallback to 1.96.
  const table: Record<number, number> = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228 }
  return table[df] ?? 1.96
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`
}

function rangePct(c: [number, number]): string {
  return `[${(c[0] * 100).toFixed(1)}, ${(c[1] * 100).toFixed(1)}]`
}

function num(x: number): string {
  if (x >= 1000) return x.toFixed(0)
  return x.toFixed(1)
}

function rangeNum(c: [number, number]): string {
  return `[${num(c[0])}, ${num(c[1])}]`
}

function nullNum(x: number | null): string {
  if (x === null) return "N/A"
  return num(x)
}
