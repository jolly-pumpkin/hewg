# hewg

> **Status: not ready for use.** This is v0-in-progress of an experimental research tool. The CLI surface, annotation grammar, and diagnostic codes may all change without notice. Do not depend on it.

Hewg is a static analyzer that reads structured JSDoc annotations from TypeScript source and enforces effect rows, capability threading, and machine-readable contracts on top of TypeScript's existing type system. It emits JSON-Lines diagnostics designed for LLM consumption and exposes `hewg contract <symbol>` to return a compact, structured signature for any annotated symbol. The thesis it is built to test is narrow and falsifiable: machine-readable effect, capability, and contract annotations on existing TypeScript code reduce the cost of agent software engineering by enough to justify the annotation overhead.

See [`docs/hewg-design-doc.md`](../docs/hewg-design-doc.md) and [`docs/hewg-roadmap.md`](../docs/hewg-roadmap.md) for the full design and epic plan.

## Development

```sh
bun install
bun test
bun run build:linux   # produces ./dist/hewg
./dist/hewg version
```
