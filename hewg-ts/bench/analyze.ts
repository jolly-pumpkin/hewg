import { existsSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { cac } from "cac"
import { aggregate, loadResults, renderMarkdown } from "./lib/report.ts"

/**
 * @hewg-module bench/analyze
 */

const DEFAULT_RESULTS = "bench/results"
const DEFAULT_OUT = "bench/results/report.md"
const DEFAULT_ANNOTATION_COST = "bench/annotation-cost.md"

const cli = cac("hewg-bench-analyze")

cli
  .command("", "Aggregate bench/results into a Markdown report")
  .option("--results-dir <path>", "Where results live", { default: DEFAULT_RESULTS })
  .option("--tasks <ids>", "Comma-separated task ids to include")
  .option("--out <path>", "Output path", { default: DEFAULT_OUT })
  .option("--annotation-cost <path>", "Path to annotation-cost.md", {
    default: DEFAULT_ANNOTATION_COST,
  })
  .action((options) => {
    const repoRoot = findRepoRoot()
    const resultsDir = resolvePath(options["resultsDir"] ?? DEFAULT_RESULTS, repoRoot)
    const out = resolvePath(options.out ?? DEFAULT_OUT, repoRoot)
    const costPath = resolvePath(options["annotationCost"] ?? DEFAULT_ANNOTATION_COST, repoRoot)

    const taskFilter = options.tasks !== undefined
      ? String(options.tasks).split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      : undefined

    const results = loadResults(resultsDir, taskFilter)
    const rows = aggregate(results)
    const md = renderMarkdown(rows, costPath)
    writeFileSync(out, md)
    console.log(`wrote ${out} (${rows.length} aggregate rows from ${results.length} runs)`)
  })

cli.help()

const parsed = cli.parse(process.argv, { run: false })
if (parsed.options.help) {
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
