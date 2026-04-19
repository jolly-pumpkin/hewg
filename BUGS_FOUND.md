# Bugs found while dogfooding Hewg on itself

Ledger produced during Epic 8. One row per bug; inline `<details>` under any row that needs elaboration. Fixes that land on this branch get their commit SHA filled in at PR time.

| # | Severity | Area | Symptom | Root cause | Fix commit | Status |
|---|----------|------|---------|------------|------------|--------|
| 1 | med | parser | Bare `@effects` (no effect list) was rejected with E0201, making pure functions unmarkable — contract reported `effects: null` / I0001 for intentionally-pure exports | `parseEffects` treated empty body as malformed rather than as the explicit pure declaration | Phase 1 | fixed |
| 2 | low | effect-map | 203 spurious W0003 warnings for `node:path.*`, `JSON.*`, `Array.isArray`, `Object.{keys,values,entries,freeze}`, `Number.parseInt`, etc. | These known-pure stdlib functions had no entries in the builtin effect map | Phase 4 | fixed |
| 3 | low | diagnostics | W0003/E0302/E0402/I0001 messages led with what was wrong instead of what to do next; first-time annotators read them as errors rather than as "add a map entry" or "pure is fine, mark it explicitly" | Message strings written from the analyzer's point of view, not the user's | Phase 6 | fixed |
| 4 | known-limit | effect-prop | Method calls on typed locals (e.g. `sf.getFilePath()`, `hit.fn.getParameters()`, `paramSet.has(p)`) never resolve into the effect map regardless of what keys you add | `resolvePropertyAccess` keys by receiver text (`sf.getFilePath`), which is variable-name-dependent and not project-stable. True fix needs receiver-type resolution. | — | documented; deferred to v1 |
| 5 | known-limit | effect-prop | Property reads like `process.platform`, `process.arch`, `Bun.version` are not detected as effects; a function that only reads these shows observed effects = ∅ and its declared `@effects proc.env` does not trigger E0302 | Effect propagation walks `CallExpression` descendants only; `PropertyAccessExpression` outside a call is ignored | — | documented; Hewg users can declare truthful effects that outrun detection |
| 6 | low | build | Self-check against the default `tsconfig.json` picks up `tests/fixtures/**`, which are intentionally broken fixtures designed to exercise diagnostics — producing failing output on an otherwise clean tree | `tsconfig.json` `include` covers `tests/**` and `bench/**` | Phase 0 (`tsconfig.hewg.json`) | worked around |

## Notes

Total real bugs fixed: **3** (#1, #2, #3). The remaining three are either documented limitations of v0 (#4, #5) or a workaround rather than a true fix (#6). The epic's "10 bugs" target was a rough order of magnitude — the dogfooding process also forced:

- Adding 33 new entries to `stdlib/effect-map.json` (`node:path.*`, `JSON.*`, `Array.*`, `Object.*`, `Number.*`, `String.*`, bare-global aliases for `parseInt` et al.)
- Scoping self-check via `tsconfig.hewg.json` so fixture files don't contaminate the clean run
- Rewriting five diagnostic message strings for a first-time-annotator mental model (see Phase 6 commits)

The remaining warning surface (~387 W0003 on ts-morph method calls) is the expected cost of #4 and is explicitly out of scope per the epic's non-goals ("Zero warnings. Warnings about unknown callees are expected for unannotated dependencies.").
