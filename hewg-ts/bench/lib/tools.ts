import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve, sep } from "node:path"
import { spawnSync } from "node:child_process"
import { runCheck } from "../../src/commands/check.ts"
import { runContract } from "../../src/commands/contract.ts"
import type { Condition, ToolResult, ToolSchema } from "./types.ts"
import { writeFileEnsureDir } from "./workspace.ts"

/**
 * @hewg-module bench/lib/tools
 */

export type ToolBundle = {
  schemas: ToolSchema[]
  execute: (
    toolUseId: string,
    name: string,
    input: Record<string, unknown>,
  ) => ToolResult
}

export type ToolBundleOptions = {
  workspace: string
  testScript: string
  condition: Condition
  allTools: ToolSchema[]
  condition4Tools: ToolSchema[]
}

/**
 * @hewg-module bench/lib/tools
 * @effects fs.read
 */
export function buildToolBundle(opts: ToolBundleOptions): ToolBundle {
  const schemas: ToolSchema[] = [...opts.allTools]
  if (opts.condition === 4) schemas.push(...opts.condition4Tools)

  const execute = (
    toolUseId: string,
    name: string,
    input: Record<string, unknown>,
  ): ToolResult => {
    switch (name) {
      case "read_file":
        return runReadFile(toolUseId, opts.workspace, input)
      case "edit_file":
        return runEditFile(toolUseId, opts.workspace, input)
      case "run_tests":
        return runRunTests(toolUseId, opts.workspace, opts.testScript)
      case "hewg_check":
        if (opts.condition !== 4) return errResult(toolUseId, `tool ${name} is not available in this condition`)
        return runHewgCheck(toolUseId, opts.workspace)
      case "hewg_contract":
        if (opts.condition !== 4) return errResult(toolUseId, `tool ${name} is not available in this condition`)
        return runHewgContract(toolUseId, opts.workspace, input)
      default:
        return errResult(toolUseId, `unknown tool: ${name}`)
    }
  }

  return { schemas, execute }
}

function runReadFile(
  toolUseId: string,
  workspace: string,
  input: Record<string, unknown>,
): ToolResult {
  const path = String(input.path ?? "")
  if (path === "") return errResult(toolUseId, "read_file: missing `path`")
  const abs = safeResolve(workspace, path)
  if (abs === null) return errResult(toolUseId, `read_file: path escapes workspace: ${path}`)
  if (!existsSync(abs)) return errResult(toolUseId, `read_file: file not found: ${path}`)
  try {
    const text = readFileSync(abs, "utf8")
    return { toolUseId, content: text, isError: false }
  } catch (e) {
    return errResult(toolUseId, `read_file: ${(e as Error).message}`)
  }
}

function runEditFile(
  toolUseId: string,
  workspace: string,
  input: Record<string, unknown>,
): ToolResult {
  const path = String(input.path ?? "")
  const oldS = typeof input.old_string === "string" ? input.old_string : null
  const newS = typeof input.new_string === "string" ? input.new_string : null
  if (path === "" || oldS === null || newS === null) {
    return errResult(toolUseId, "edit_file: requires `path`, `old_string`, `new_string`")
  }
  const abs = safeResolve(workspace, path)
  if (abs === null) return errResult(toolUseId, `edit_file: path escapes workspace: ${path}`)

  if (oldS === "") {
    // Create new file.
    if (existsSync(abs)) {
      return errResult(toolUseId, `edit_file: refuses to overwrite existing file with empty old_string: ${path}`)
    }
    writeFileEnsureDir(abs, newS)
    return { toolUseId, content: `created ${path} (${newS.length} bytes)`, isError: false }
  }

  if (!existsSync(abs)) {
    return errResult(toolUseId, `edit_file: file not found: ${path}`)
  }
  const original = readFileSync(abs, "utf8")
  const idx = original.indexOf(oldS)
  if (idx === -1) {
    return errResult(toolUseId, `edit_file: old_string not found in ${path}`)
  }
  const last = original.lastIndexOf(oldS)
  if (last !== idx) {
    return errResult(toolUseId, `edit_file: old_string occurs more than once in ${path}; include more context to make it unique`)
  }
  const updated = original.slice(0, idx) + newS + original.slice(idx + oldS.length)
  writeFileSync(abs, updated)
  return {
    toolUseId,
    content: `edited ${path} (replaced ${oldS.length} bytes with ${newS.length} bytes)`,
    isError: false,
  }
}

function runRunTests(toolUseId: string, workspace: string, testScript: string): ToolResult {
  const scriptAbs = isAbsolute(testScript) ? testScript : resolve(workspace, testScript)
  if (!existsSync(scriptAbs)) {
    return errResult(toolUseId, `run_tests: missing script ${scriptAbs}`)
  }
  const res = spawnSync("bash", [scriptAbs], {
    cwd: workspace,
    encoding: "utf8",
    timeout: 60_000,
  })
  const body = [
    `exit_code: ${res.status ?? "signal:" + (res.signal ?? "?")}`,
    res.stdout !== undefined && res.stdout !== "" ? `stdout:\n${res.stdout}` : "stdout: (empty)",
    res.stderr !== undefined && res.stderr !== "" ? `stderr:\n${res.stderr}` : "stderr: (empty)",
  ].join("\n")
  return { toolUseId, content: body, isError: (res.status ?? 1) !== 0 }
}

function runHewgCheck(toolUseId: string, workspace: string): ToolResult {
  const tsconfig = resolve(workspace, "tsconfig.json")
  if (!existsSync(tsconfig)) {
    return errResult(toolUseId, "hewg_check: no tsconfig.json at workspace root")
  }
  const res = runCheck({ project: tsconfig, format: "json", cwd: workspace })
  const body = res.stdout.length > 0 ? res.stdout : "(no diagnostics)"
  return { toolUseId, content: body, isError: res.exitCode === 2 }
}

function runHewgContract(
  toolUseId: string,
  workspace: string,
  input: Record<string, unknown>,
): ToolResult {
  const symbol = String(input.symbol ?? "")
  if (symbol === "") return errResult(toolUseId, "hewg_contract: missing `symbol`")
  const tsconfig = resolve(workspace, "tsconfig.json")
  if (!existsSync(tsconfig)) {
    return errResult(toolUseId, "hewg_contract: no tsconfig.json at workspace root")
  }
  const res = runContract(symbol, { project: tsconfig, format: "json", cwd: workspace })
  if (res.exitCode === 0) return { toolUseId, content: res.stdout, isError: false }
  return { toolUseId, content: res.stderr.length > 0 ? res.stderr : `exit ${res.exitCode}`, isError: true }
}

function safeResolve(workspace: string, path: string): string | null {
  const abs = resolve(workspace, path)
  const wsAbs = resolve(workspace)
  if (abs !== wsAbs && !abs.startsWith(wsAbs + sep)) return null
  return abs
}

function errResult(toolUseId: string, msg: string): ToolResult {
  return { toolUseId, content: msg, isError: true }
}

/**
 * @hewg-module bench/lib/tools
 * @effects fs.read
 */
export function loadToolSchemas(paths: string[], repoRoot: string): ToolSchema[] {
  return paths.map((p) => {
    const abs = isAbsolute(p) ? p : join(repoRoot, p)
    const raw = readFileSync(abs, "utf8")
    return JSON.parse(raw) as ToolSchema
  })
}

// re-export for callers that need dirname for a given path
export { dirname }
