import pkg from "../../package.json" with { type: "json" }
import {
  buildBaseline,
  filterBaselined,
  loadBaseline,
  writeBaseline,
} from "../baseline.ts"
import { DIAGNOSTIC_REGISTRY } from "../diag/codes.ts"
import type { Diagnostic } from "../diag/types.ts"
import { collectDiagnostics } from "./check.ts"

export type BaselineSubcommand = "update" | "status"

export type RunBaselineOptions = {
  project?: string
  subcommand: BaselineSubcommand
  cwd?: string
}

export type RunBaselineResult = {
  exitCode: 0 | 1 | 2
  stdout: string
  stderr: string
}

/**
 * @hewg-module commands/baseline
 * @effects fs.read, fs.write
 */
export function runBaseline(opts: RunBaselineOptions): RunBaselineResult {
  if (opts.subcommand === "update") return runUpdate(opts)
  return runStatus(opts)
}

function runUpdate(opts: RunBaselineOptions): RunBaselineResult {
  const collected = collectDiagnostics({
    project: opts.project,
    cwd: opts.cwd,
    format: "json",
  })
  if (!collected.ok) {
    return { exitCode: collected.exitCode, stdout: "", stderr: collected.stderr }
  }

  const { diagnostics, projectRoot, config } = collected

  // Strict mode: refuse if new count exceeds existing baseline count
  if (config.baseline?.strict) {
    try {
      const existing = loadBaseline(projectRoot)
      if (existing && diagnostics.length > existing.count) {
        const info = DIAGNOSTIC_REGISTRY.I0002
        const msg =
          `baseline strict mode: new violation count (${diagnostics.length}) ` +
          `exceeds existing baseline (${existing.count}). ` +
          `Fix violations before updating the baseline.\n`
        return { exitCode: 1, stdout: "", stderr: msg }
      }
    } catch {
      // If existing baseline is corrupt, allow overwrite
    }
  }

  const schema = buildBaseline(diagnostics, pkg.version)
  writeBaseline(projectRoot, schema)

  const fileCount = new Set(diagnostics.map((d) => d.file)).size
  const stdout = `Baselined ${schema.count} violation${schema.count === 1 ? "" : "s"} across ${fileCount} file${fileCount === 1 ? "" : "s"}.\n`
  return { exitCode: 0, stdout, stderr: "" }
}

function runStatus(opts: RunBaselineOptions): RunBaselineResult {
  const collected = collectDiagnostics({
    project: opts.project,
    cwd: opts.cwd,
    format: "json",
  })
  if (!collected.ok) {
    return { exitCode: collected.exitCode, stdout: "", stderr: collected.stderr }
  }

  const { diagnostics, projectRoot } = collected

  let baseline
  try {
    baseline = loadBaseline(projectRoot)
  } catch (e) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `could not read baseline: ${(e as Error).message}\n`,
    }
  }

  if (!baseline) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "no baseline file found. Run `hewg baseline update` first.\n",
    }
  }

  const { remaining, fixed } = filterBaselined(diagnostics, baseline)
  const total = baseline.count
  const newViolations = remaining.length

  const lines: string[] = [
    `Baseline: ${total} total`,
    `  Fixed:     ${fixed}`,
    `  Remaining: ${total - fixed}`,
    `  New:       ${newViolations}`,
  ]

  if (newViolations > 0) {
    lines.push("")
    lines.push("New violations:")
    for (const d of remaining) {
      lines.push(`  ${d.file}:${d.line} ${d.code}: ${d.message}`)
    }
  }

  return { exitCode: newViolations > 0 ? 1 : 0, stdout: lines.join("\n") + "\n", stderr: "" }
}
