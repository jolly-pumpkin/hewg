# hewg

An annotation-based analyzer for agent-friendly TypeScript.

> **Status: not ready for use.** v0 is in active development.

Hewg reads structured JSDoc annotations from TypeScript source and enforces effect rows, capability threading, and machine-readable contracts on top of TypeScript's existing type system. It emits JSON-Lines diagnostics designed for LLM consumption and exposes `hewg contract <symbol>` to return a compact, structured signature for any annotated symbol.

The thesis it is built to test is narrow and falsifiable: **machine-readable effect, capability, and contract annotations on existing TypeScript code reduce the cost of agent software engineering by enough to justify the annotation overhead.**

## CLI surface (v0)

- `hewg check` — validate `@effects` and `@cap` annotations across a project.
  - `--no-baseline` — ignore the baseline file and report all violations.
- `hewg baseline update` — snapshot current violations into `.hewg-baseline.json`.
- `hewg baseline status` — show how many baselined violations remain, are fixed, or are new.
- `hewg contract <symbol>` — return a compact, structured signature for one symbol.
- `hewg summary <module>` — one-line summary per exported symbol in a module.
- `hewg init [path]` — scaffold `hewg.config.json` in an existing TS project.
- `hewg version` — print version and platform.

## Gradual adoption with baselines

Hewg supports a Packwerk-inspired baseline workflow for adopting the tool on existing codebases without fixing every violation upfront:

```sh
# 1. Record all current violations as accepted
hewg baseline update

# 2. From now on, `hewg check` passes — only NEW violations fail CI
hewg check          # exits 0

# 3. See progress over time
hewg baseline status
# Baseline: 42 total
#   Fixed:     7
#   Remaining: 35
#   New:       0
```

The `.hewg-baseline.json` file should be committed to git. It acts as a ratchet: existing violations are grandfathered, but any new violation introduced by a change will fail `hewg check`.

To prevent backsliding, enable strict mode in `hewg.config.json`:

```json
{
  "baseline": { "strict": true }
}
```

With strict mode, `hewg baseline update` refuses to write if the new violation count exceeds the current baseline — you can only shrink the baseline, never grow it.

## Links

- Design: [`docs/hewg-design-doc.md`](./docs/hewg-design-doc.md)
- Roadmap: [`docs/hewg-roadmap.md`](./docs/hewg-roadmap.md)
- Annotating a codebase: [`docs/AnnotatingACodebase.md`](./docs/AnnotatingACodebase.md)
- Diagnostic catalogue: [`docs/Diagnostics.md`](./docs/Diagnostics.md)
- Built-in effect map: [`docs/EffectMap.md`](./docs/EffectMap.md)
- Bugs found while dogfooding: [`BUGS_FOUND.md`](./BUGS_FOUND.md)
- TypeScript implementation: [`hewg-ts/`](./hewg-ts/)
