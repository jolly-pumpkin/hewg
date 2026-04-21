# bench — Hewg Benchmark Harness

## What this is

Controlled experiment comparing LLM coding performance across four annotation conditions (Design doc section 9). The harness sends tasks to models, constrains their tools, and measures success rate, iterations, and token usage.

## Four conditions

1. Plain TypeScript (no JSDoc)
2. TS + standard JSDoc (`@param`, `@returns`)
3. TS + full Hewg annotations (no `hewg_check`/`hewg_contract` tools)
4. TS + full Hewg annotations + tool access

Conditions 3 and 4 share source (`conditions/3-4/`). Conditions 1 and 2 are generated from 3-4 by `scripts/build-conditions.sh`.

## Running

```bash
# Anthropic API (needs ANTHROPIC_API_KEY)
bun run bench -- run --task <id> --condition 1 --seed 1

# Local Ollama
bun run bench -- run --task <id> --condition 1 --seed 1 --ollama --model gemma4:31b

# Claude Code headless (needs claude login)
bun run bench -- run-cc --task <id> --condition 1 --seed 1 --model sonnet

# Check what runs exist
bun run bench -- status --task <id>

# Generate report
bun run bench:analyze -- --tasks <id> --out bench/results/report.md
```

## Architecture

- `harness.ts` — CLI entry point (cac). Commands: `run`, `run-cc`, `status`.
- `lib/agent-loop.ts` — Core loop: send messages, execute tool calls, check budgets. Used by `run` command.
- `lib/run.ts` — Orchestrates workspace setup, agent loop, ground-truth check, result serialization.
- `lib/tools.ts` — `ToolBundle`: sandboxed `read_file`, `edit_file`, `run_tests`, `hewg_check`, `hewg_contract`. Path-escaping prevented via `safeResolve`.
- `lib/anthropic-client.ts` — `ModelClient` interface + Anthropic Messages API implementation.
- `lib/ollama-client.ts` — `ModelClient` for local Ollama (OpenAI-compatible chat completions).
- `lib/claude-code-runner.ts` — Runs tasks via `claude -p` headless, bypassing the custom agent loop.
- `lib/workspace.ts` — Copy condition files into `/tmp/hewg-bench/`, snapshot/diff trees.
- `lib/metrics.ts` — Post-run metrics extraction.
- `lib/live-log.ts` — TTY live logging of agent activity.
- `lib/report.ts` — Used by `analyze.ts` to aggregate results into Markdown.
- `lib/types.ts` — Shared types: `Condition`, `BenchConfig`, `TaskSpec`, `RunResult`, `TurnLog`, etc.

## Task structure

Each task under `tasks/<id>/` has:
- `task.json` — `{id, description, conditions, test}`
- `README.md` — Task prompt (fed to agent)
- `test.sh` — Ground-truth check (exit 0 = pass)
- `conditions/{1,2,3-4}/` — Source files per condition

## Key conventions

- `config.json` is the single source of reproducibility. Every run embeds a snapshot of it.
- Workspaces are created under `/tmp/hewg-bench/<task>-<cond>-<seed>/`.
- Results go to `results/<task>/<cond>/<seed>/result.json` (gitignored).
- Tools are sandboxed to the workspace — `safeResolve` blocks path traversal.
- `hewg_check` and `hewg_contract` are only available in condition 4.
- `build-conditions.sh` is idempotent — safe to re-run.
- Task test scripts use `bun -e` (not `bun eval`), and `tsc` checks are conditional on `command -v tsc`.

## Common tasks

**Add a new task:** Copy the `smoke` task structure, author `conditions/3-4/` with Hewg annotations, run `./bench/scripts/build-conditions.sh bench/tasks/<id>` to generate conditions 1 and 2.

**Re-generate conditions 1 & 2 after editing 3-4:**
```bash
./bench/scripts/build-conditions.sh bench/tasks/<task-id>
```

**Run a quick pilot:** `bun run bench -- run --task <id> --condition 1 --seed 1 --ollama --model gemma4:31b`
