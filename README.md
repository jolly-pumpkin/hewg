# hewg

An annotation-based analyzer for agent-friendly TypeScript.

> **Status: not ready for use.** v0 is in active development.

Hewg reads structured JSDoc annotations from TypeScript source and enforces effect rows, capability threading, and machine-readable contracts on top of TypeScript's existing type system. It emits JSON-Lines diagnostics designed for LLM consumption and exposes `hewg contract <symbol>` to return a compact, structured signature for any annotated symbol.

The thesis it is built to test is narrow and falsifiable: **machine-readable effect, capability, and contract annotations on existing TypeScript code reduce the cost of agent software engineering by enough to justify the annotation overhead.**

## CLI surface (v0)

- `hewg check` — validate `@effects` and `@cap` annotations across a project.
- `hewg contract <symbol>` — return a compact, structured signature for one symbol.
- `hewg summary <module>` — one-line summary per exported symbol in a module.
- `hewg init [path]` — scaffold `hewg.config.json` in an existing TS project.
- `hewg version` — print version and platform.

## Links

- Design: [`docs/hewg-design-doc.md`](./docs/hewg-design-doc.md)
- Roadmap: [`docs/hewg-roadmap.md`](./docs/hewg-roadmap.md)
- Annotating a codebase: [`docs/AnnotatingACodebase.md`](./docs/AnnotatingACodebase.md)
- Diagnostic catalogue: [`docs/Diagnostics.md`](./docs/Diagnostics.md)
- Built-in effect map: [`docs/EffectMap.md`](./docs/EffectMap.md)
- Bugs found while dogfooding: [`BUGS_FOUND.md`](./BUGS_FOUND.md)
- TypeScript implementation: [`hewg-ts/`](./hewg-ts/)
