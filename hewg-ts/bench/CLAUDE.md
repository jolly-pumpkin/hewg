# bench — Hewg Benchmark Harness

## What this is

Controlled experiment comparing LLM coding performance across four annotation conditions (Design doc section 9). The harness sends tasks to models, constrains their tools, and measures success rate, iterations, and token usage.

## Five conditions

1. Plain TypeScript (no JSDoc)
2. TS + standard JSDoc (`@param`, `@returns`)
2.5. TS + standard JSDoc + architectural CLAUDE.md (no annotation schema)
3. TS + full Hewg annotations + CLAUDE.md (no tools)
4. TS + full Hewg annotations + CLAUDE.md + tool access (`hewg_check`, `hewg_contract`, `hewg_scope`)

Conditions 3 and 4 share source (`conditions/3-4/`). Conditions 1, 2, and 2.5 are generated from 3-4 by `scripts/build-conditions.sh`. Condition 2.5 gets a hand-written `claude-md-2.5.md` as its CLAUDE.md (architectural map only, no annotation schema).

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
- `lib/tools.ts` — `ToolBundle`: sandboxed `read_file`, `edit_file`, `run_tests`, `hewg_check`, `hewg_contract`, `hewg_scope`. Path-escaping prevented via `safeResolve`.
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
- `conditions/{1,2,2.5,3-4}/` — Source files per condition

## Live logging

`--live` (default when stderr is a TTY) streams agent activity to stderr. `--verbose` shows full agent text instead of truncated. `--no-live` silences it. For `run-cc`, live mode pipes Claude Code's stderr through directly. Three labeled actors: Agent (model reasoning), Tool/Result (calls + outcomes), System (budget/error events). Output goes to stderr only — stdout stays clean.

## Key conventions

- `config.json` is the single source of reproducibility. Every run embeds a snapshot of it.
- Workspaces are created under `/tmp/hewg-bench/<task>-<cond>-<seed>/`.
- Results go to `results/<task>/<cond>/<seed>/result.json` (gitignored).
- Tools are sandboxed to the workspace — `safeResolve` blocks path traversal.
- `hewg_check`, `hewg_contract`, and `hewg_scope` are only available in condition 4.
- `build-conditions.sh` is idempotent — safe to re-run. Generates conditions 1, 2, and 2.5.
- Task test scripts use `bun -e` (not `bun eval`), and `tsc` checks are conditional on `command -v tsc`.

## Common tasks

**Add a new task:** Copy the `smoke` task structure, author `conditions/3-4/` with Hewg annotations, run `./bench/scripts/build-conditions.sh bench/tasks/<id>` to generate conditions 1, 2, and 2.5. For tasks sharing a codebase (like taskq-*), point conditions in task.json to `../taskq/conditions/`.

**Re-generate conditions 1, 2 & 2.5 after editing 3-4:**
```bash
./bench/scripts/build-conditions.sh bench/tasks/<task-id>
```

**Run a quick pilot:** `bun run bench -- run --task <id> --condition 1 --seed 1 --ollama --model gemma4:31b`
