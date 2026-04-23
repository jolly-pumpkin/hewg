# hewg

> **Status: experimental.** CLI surface, annotation grammar, and diagnostic codes may change without notice.

Hewg is a static analyzer for TypeScript that enforces effect annotations in JSDoc comments. Mark your functions with `@effects` to declare what IO they perform, then let Hewg verify those declarations and generate documentation your LLM coding agent can use.

**The pitch:** `@effects` annotations + `hewg init --claude-md` = your LLM agent understands your architecture.

Benchmark results show annotated codebases with a generated CLAUDE.md improve LLM agent efficiency by ~9% overall and up to 23% on tasks requiring effect-boundary reasoning. See [`bench/results/pilot-report.md`](bench/results/pilot-report.md) for details.

## Quick start

```sh
# 1. Add @effects to your functions
#    @effects           → pure (no IO)
#    @effects fs.read   → reads filesystem
#    @effects net.https → makes HTTP requests

# 2. Auto-infer annotations for unannotated functions
hewg infer --project tsconfig.json

# 3. Validate annotations match actual behavior
hewg check

# 4. Generate a CLAUDE.md for your LLM agent
hewg init --claude-md
```

## Annotations

The core annotation is `@effects`. An empty `@effects` means the function is **pure** — no IO, no side effects. List effects to declare what IO a function performs:

```typescript
/** @effects */
function add(a: number, b: number): number { return a + b }

/** @effects net.https, log */
async function fetchAndLog(url: string): Promise<void> {
  const res = await fetch(url)
  console.log(await res.text())
}
```

Common effects: `net.https`, `fs.read`, `fs.write`, `log`, `proc.exec`, `rand`, `time.read`.

### Advanced annotations

These are optional and provide richer contracts:

- `@cap <name> <effect>` — Capability parameter (dependency injection for effects)
- `@pre <condition>` — Precondition
- `@post <condition>` — Postcondition
- `@idempotent` — Safe to call multiple times
- `@layer <tier>` — Architectural tier (`api`, `service`, `command`, `output`, `lib`)
- `@hewg-module <path>` — Module membership

## Commands

```sh
# Core workflow
hewg check [--format json|sarif] [--no-baseline]   # validate annotations
hewg infer [--format diff|json|apply]               # auto-infer @effects
hewg init --claude-md                               # generate CLAUDE.md
hewg init [path]                                    # scaffold hewg.config.json

# Exploration
hewg scope <symbol> [--depth N] [--format json]     # blast radius query
hewg contract <symbol> [--format human]             # structured contract
hewg summary <module>                               # one-line summary per export

# Maintenance
hewg baseline update                                # snapshot violations
hewg baseline status                                # show progress
hewg version                                        # print version
```

## How it works

1. **`hewg check`** walks the call graph of every `@effects`-annotated function. If a function calls something whose effects aren't declared, it emits a diagnostic.
2. **`hewg infer`** does the reverse — walks unannotated functions and computes what their `@effects` should be.
3. **`hewg init --claude-md`** reads the annotation graph and generates an architecture map, effect call graph, and decision table that LLM agents use to avoid effect-boundary violations.
4. **`hewg scope`** answers "what breaks if I change this function?" with a bidirectional BFS of the call graph.

See [`docs/hewg-design-doc.md`](../docs/hewg-design-doc.md) for the full design.

## Development

```sh
bun install
bun test
bun run build:linux   # produces ./dist/hewg
./dist/hewg version
```
