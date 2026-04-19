# bench — Hewg benchmark harness

This directory houses the experiment from
[`docs/hewg-design-doc.md` §9](../../docs/hewg-design-doc.md). Epics 10–12 of
[`docs/hewg-roadmap.md`](../../docs/hewg-roadmap.md) consume it.

## Layout

```
bench/
├── config.json         single source of reproducibility
├── harness.ts          CLI: run one (task, condition, seed)
├── analyze.ts          CLI: aggregate run logs into a Markdown report
├── lib/                library code shared by harness + analyze
├── prompts/            one system prompt per condition
├── tools/              Anthropic tool-use schemas for the agent
├── tasks/              task fixtures (Epic 10 scales this to 30–50)
└── results/            per-run logs and patches (gitignored)
```

## Conditions

Per Design §9.1:

1. Plain TypeScript.
2. TS + JSDoc types.
3. TS + Hewg annotations, no tool.
4. TS + Hewg annotations + tool access.

## Quickstart

```
# Prereq: ANTHROPIC_API_KEY in the environment.

# Run the smoke task across all conditions, three seeds each:
bun run bench -- run --task smoke --all

# Inspect which runs exist:
bun run bench -- status --task smoke

# Build the Markdown report:
bun run bench:analyze -- --tasks smoke --out bench/results/smoke-report.md
```

## Reproducibility

Every run embeds a snapshot of `config.json` into its `result.json`.  A run
is reproducible from `config.json` plus the task directory at a given repo
SHA.  No other inputs.
