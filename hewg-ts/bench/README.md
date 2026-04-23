# bench — Hewg benchmark harness

This directory houses the experiment from
[`docs/hewg-design-doc.md` §9](../../docs/hewg-design-doc.md). Epics 10–12 of
[`docs/hewg-roadmap.md`](../../docs/hewg-roadmap.md) consume it.

## Layout

```
bench/
├── config.json         single source of reproducibility
├── harness.ts          CLI: run (task, condition, seed) and run-cc
├── analyze.ts          CLI: aggregate run logs into a Markdown report
├── lib/                library code shared by harness + analyze
│   ├── anthropic-client.ts   Anthropic API client
│   ├── ollama-client.ts      Ollama (local model) client
│   ├── claude-code-runner.ts Claude Code headless runner
│   └── ...
├── prompts/            one system prompt per condition
├── tools/              Anthropic tool-use schemas for the agent
├── scripts/            build-conditions.sh and other helpers
├── tasks/              10 task fixtures (+ smoke)
├── annotation-cost.md  annotation effort tracking
├── task-rationale.md   why each task was chosen
└── results/            per-run logs and patches (gitignored)
```

## Conditions

Per Design §9.1:

1. Plain TypeScript.
2. TS + JSDoc types.
3. TS + Hewg annotations, no tool.
4. TS + Hewg annotations + tool access.

## Three Runner Paths

### 1. Anthropic API (direct agent loop)

Uses the custom agent loop in `lib/agent-loop.ts` with Anthropic's Messages API.

```bash
# Prereq: ANTHROPIC_API_KEY in the environment.
bun run bench -- run --task smoke --condition 1 --seed 1
bun run bench -- run --task smoke --all
```

### 2. Ollama (local models)

Same custom agent loop, but calls a local Ollama instance. No API key needed.

```bash
# Prereq: Ollama running locally (http://localhost:11434).
bun run bench -- run --task smoke --condition 1 --seed 1 --ollama --model gemma4:31b
```

### 3. Claude Code headless

Bypasses the custom agent loop entirely — runs `claude -p` which manages its
own tools (Bash, Read, Edit, Glob, Grep), system prompt, and iteration.

```bash
# Prereq: logged in to Claude Code (claude /login).
bun run bench -- run-cc --task smoke --condition 1 --seed 1 --model sonnet
bun run bench -- run-cc --task smoke --condition 1 --seed 1 --model opus --max-budget 2.0
```

## Live Log Trail

Both `run` and `run-cc` support a live log trail that streams agent activity to
stderr in real time. It's on by default when stderr is a TTY.

```bash
# Live output on by default in a terminal
bun run bench -- run --task smoke --condition 1 --seed 1

# Show full (untruncated) agent reasoning text
bun run bench -- run --task smoke --condition 1 --seed 1 --verbose

# Disable live output (e.g. for CI)
bun run bench -- run --task smoke --condition 1 --seed 1 --no-live

# run-cc pipes Claude Code's own stderr through when --live is on
bun run bench -- run-cc --task smoke --condition 1 --live
```

Three actors are labeled on every line so you can tell who is doing what:

- **Agent** — the model's reasoning (truncated to ~120 chars; `--verbose` for full)
- **Tool** / **Result** — tool calls and their outcomes (✓ / ✗)
- **System** — harness events (budget warnings, retries, errors)

Live output goes to stderr only; stdout stays clean for structured results.

## Other Commands

```bash
# Inspect which runs exist:
bun run bench -- status --task smoke

# Build the Markdown report:
bun run bench:analyze -- --tasks smoke --out bench/results/smoke-report.md

# Rebuild condition 1 and 2 variants from condition 3-4 source:
./bench/scripts/build-conditions.sh bench/tasks/<task-id>
```

## Tasks (Epic 10)

| Task | Category | Files |
|------|----------|-------|
| add-retry-no-new-effects | effect-discovery | 3 |
| make-idempotent | effect-discovery | 4 |
| extract-pure-transform | effect-discovery | 3 |
| inject-http-client | capability-threading | 3 |
| split-pure-io | capability-threading | 3 |
| add-error-variant | cross-file-edit | 5 |
| rename-and-update-callers | cross-file-edit | 6 |
| propagate-async | cross-file-edit | 5 |
| optimize-preserving-post | contract-respecting | 3 |
| refactor-algorithm | null-hypothesis | 2 |

See `task-rationale.md` for why each task was chosen.

## Reproducibility

Every run embeds a snapshot of `config.json` into its `result.json`.  A run
is reproducible from `config.json` plus the task directory at a given repo
SHA.  No other inputs.
