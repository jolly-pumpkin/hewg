# Hewg: roadmap and epics

**Companion to:** [Design.md](./Design.md)
**Status:** v0 plan
**Scope:** zero to a measured result

This document decomposes Hewg's v0 into a sequence of epics with explicit goals, deliverables, and exit criteria. The ordering is deliberate: each epic is the minimum work that unblocks the next, and each epic ends with something demonstrable. Nothing here is speculative — everything maps to a section of [Design.md](./Design.md).

The meta-shape: **infrastructure → protocol → analysis → experiment → judgment**. We build the smallest thing that can produce a diagnostic, then the smallest thing that can produce a contract, then the smallest analyses that give those outputs meaning, then the experiment that tells us whether any of it mattered. The experiment is the product.

If at any epic the exit criteria slip by more than 50%, that is the signal to stop and re-scope. The project fails cleanly at an epic boundary, not in the middle of a six-month build.

---

## Epic map

| # | Epic | Weekends | Exit condition |
|---|---|---|---|
| 0 | Project skeleton | 0.5 | `hewg version` runs from a compiled binary |
| 1 | Diagnostic protocol | 0.5 | Registry, examples, renderers (text + JSON + SARIF) |
| 2 | Annotation parser | 1 | All six tags parse; malformed tags emit `E0201`/`E0202` |
| 3 | `hewg contract` (the thesis command) | 1 | Returns structured JSON for one annotated symbol |
| 4 | Built-in effect map | 0.5 | Coverage for Node + Web + top npm packages |
| 5 | Effect propagation (`hewg check`, partial) | 1.5 | `E0301` fires on real effect mismatches |
| 6 | Capability flow (`hewg check`, complete) | 1 | `E0401`/`E0402` fire on real capability mismatches |
| 7 | `hewg summary` + `hewg init` | 0.5 | Full CLI surface from §7 of Design.md |
| 8 | Dogfood and harden | 1 | Hewg checks itself with zero errors |
| 9 | Benchmark harness | 1.5 | Can run one task across all four conditions |
| 10 | Task corpus | 2 | 10 tasks, ground-truth validated |
| 11 | First experiment | 1 | One real open-source repo, informal result |
| 12 | Scale corpus to 30–50 | 2 | Pre-registered thresholds; final report |

**Total: ~13 weekends.** The timeline from Design.md (§8) called for "3–4 weekends to a working checker, 2 weekends for the benchmark." That number was for the code. This plan includes task-corpus construction and the first real experiment, which are the actual deliverables. If any epic runs long, §9 onward is where to compress by narrowing scope (fewer tasks, fewer conditions), not by skipping epics.

---

## Epic 0 — Project skeleton

**Why it comes first:** Every subsequent epic needs a place to land. Getting distribution right early means the experiment can run on any machine, including CI. A compiled binary from day zero also forces the dependency set to stay small.

**Goals:**

- Monorepo-style layout per Design.md §8.
- Bun + TypeScript + `ts-morph` + `cac` + `bun test` stack stood up.
- `bun build --compile` produces a working `hewg` binary on macOS/Linux.
- Published as an npm package with a `bin/hewg` entry plus the native binaries.
- CI runs tests and builds on every commit.

**Non-goals:**

- Any analysis logic.
- Windows binary (add in Epic 8 if needed).
- npm publication to the registry (local tarball install is fine for v0).

**Deliverables:**

1. `hewg-ts/` repo matching the layout in Design.md §8.
2. `package.json`, `tsconfig.json`, `bunfig.toml` configured.
3. `src/cli.ts` with a `hewg version` subcommand that prints version + platform.
4. `bun build --compile --target=bun-linux-x64 --outfile=dist/hewg` in `package.json` scripts.
5. One smoke test: `tests/cli.test.ts` asserts `hewg version` exits 0 and prints expected output.
6. GitHub Actions workflow: run `bun test` and `bun build --compile` on push.
7. `README.md` with one paragraph describing what Hewg will become (the Design.md §0 pitch) and a "not ready for use" warning.

**Exit criteria:**

- `./dist/hewg version` prints `hewg 0.0.1` (or similar) on a clean Linux machine with no Node installed.
- CI green.

**Risk:** Bun's `--compile` has historically had sharp edges on some platforms. If a platform blocks the epic, fall back to Node + `pkg` or ship as a pure-JS npm package with `npx hewg` entry. Do not rewrite in Go — that's explicitly out per the research report.

---

## Epic 1 — Diagnostic protocol

**Why it comes second:** Diagnostics are the product. Every analysis epic produces diagnostics. Settling the schema, code registry, and renderers before writing any analysis means the analysis code has a fixed target. The alternative — inventing diagnostic shapes as each analysis gets written — produces drift and churns the JSON-Lines format the experiment depends on.

This epic is also a forcing function: writing the examples file (one concrete diagnostic per code) surfaces design questions about span granularity and suggestion types early, when they are cheap to answer.

**Goals:**

- `src/diag/types.ts` defines `Diagnostic`, `Span`, `RelatedInfo`, `Suggestion`, `Note`.
- `src/diag/codes.ts` registers every v0 code from Design.md §5.3.
- `src/diag/examples.ts` has one example `Diagnostic` per registered code.
- `src/diag/render.ts` implements three renderers: `human`, `json` (JSON-Lines), `sarif` (SARIF 2.1.0).
- `tests/diag.test.ts` fails if any registered code lacks an example — this is the guard that keeps the catalogue complete.

**Non-goals:**

- Any real analysis producing diagnostics (that's Epics 5 and 6).
- LSP diagnostic translation (v1).

**Deliverables:**

1. Full registry with codes `E0001`, `E0002`, `E0201`, `E0202`, `E0301`, `E0302`, `E0303`, `E0401`, `E0402`, `E0403`, `E0501`, `W0001`, `W0002`.
2. Example payloads committed to `examples.ts`. Every example is syntactically valid JSON and round-trips through the JSON renderer.
3. Human renderer prints file:line:col, the message, a carat-underlined source span, and ordered suggestions. Match Rust's style, not GCC's.
4. JSON renderer emits one `Diagnostic` per line, no pretty-printing, no trailing newline on the final line.
5. SARIF renderer emits a conforming SARIF 2.1.0 log file. Validated against the OASIS schema as a test step.
6. `tests/diag.test.ts` verifies: every code in `codes.ts` has an example; every example renders cleanly in all three formats; the JSON renderer output is parseable as JSON-Lines.
7. `docs/Diagnostics.md` auto-generated from the registry + examples.

**Exit criteria:**

- `hewg check` is not yet implemented, but a test harness can construct `Diagnostic` values, pass them through each renderer, and see the expected output for every code in the catalogue.
- The SARIF output passes validation via `ajv` against the SARIF 2.1.0 schema.

**Risk:** SARIF is verbose and fiddly. If the SARIF renderer costs more than a third of this epic's budget, defer it to v0.1 and ship v0 with only text + JSON. Update `Design.md §5.4` accordingly.

---

## Epic 2 — Annotation parser

**Why it comes third:** Every annotation tag is a grammar that has to be parsed before it can be analyzed. This epic produces the typed representation every later epic consumes. It is the component most likely to have fiddly edge cases, so doing it early with a thorough test fixture set pays off.

**Goals:**

- Parser for all six v0 tags: `@hewg-module`, `@effects`, `@cap`, `@pre`, `@post`, `@cost`.
- Typed representation: `ParsedAnnotation = { kind: "effects"; effects: EffectName[] } | { kind: "cap"; param: string; effectKind: EffectName; scope: CapScope } | ...`.
- Integration with `ts-morph`: given a `Node`, return its typed annotation list.
- Malformed tags produce `E0201` (syntax) or `E0202` (e.g. `@cap` names a parameter that doesn't exist on the function).
- `@pre`/`@post` expressions are parsed but not validated beyond "is it syntactically a TypeScript expression." We store them as strings plus a parsed AST.
- `@cost` fields are parsed into a structured record; unknown fields emit `W0001` but are preserved verbatim.

**Non-goals:**

- Any semantic checking beyond parameter-name resolution for `@cap`.
- Evaluation of `@pre`/`@post` predicates.
- Any analysis pass.

**Deliverables:**

1. `src/annotations/types.ts` — typed representations.
2. `src/annotations/parser.ts` — the parser.
3. `src/annotations/effect-vocab.ts` — built-in effect vocabulary (`net.http`, `fs.write`, etc.).
4. `tests/annotations.test.ts` — at least three fixtures per tag: minimal, maximal, malformed.
5. Fixtures under `tests/fixtures/annotations/` as real `.ts` files with JSDoc blocks; the test loads them with `ts-morph` and asserts the parsed output.
6. Handling of malformed tags: parser never throws, always returns a `{ annotations, errors }` pair, callers decide what to do.

**Exit criteria:**

- All six tag types parse on the "maximal" fixture examples from Design.md §4.
- Malformed fixtures produce the expected `E0201` / `E0202` / `E0501` / `W0001` / `W0002` codes.
- The `refund.ts` example from Design.md §1 parses completely, producing the exact annotation structure the design doc claims.

**Risk:** TypeScript's built-in JSDoc parser handles well-formed tags but is surprisingly permissive about malformed ones. Accept the TS parser's output as input, then re-validate against Hewg's stricter grammar; do not reimplement JSDoc parsing. If a tag's format collides with an existing JSDoc convention (e.g. `@param`), rename the Hewg tag rather than fight the TS parser.

---

## Epic 3 — `hewg contract` (the thesis command)

**Why this is third and not fifth:** `hewg contract` is what the experiment actually tests. It is the information-density command — the one that returns 200 tokens of structured signature instead of 2,000 tokens of body. Building it before `hewg check` forces the design to treat the annotations as the *product*, with checking as a support function, not the other way around. This ordering choice is philosophical and intentional: if the thesis is right, `contract` is doing most of the work in the benchmark.

**Goals:**

- `hewg contract <symbol>` implemented as specified in Design.md §7.2.
- Three forms of symbol lookup: `module/path::name`, `file.ts:name`, `name`.
- Output is the JSON structure from §7.2, ~200 tokens for a typical annotated symbol.
- Errors for: symbol not found (`E0003`), ambiguous symbol (`E0004`), symbol not annotated (`I0001` — informational, returns the signature with null annotation fields).

**Non-goals:**

- Analysis of effects or capabilities beyond what the annotation states.
- Cross-file call graph walking.
- `hewg summary` (Epic 7).
- `hewg callers` (out of scope, v0.2).

**Deliverables:**

1. `src/commands/contract.ts`.
2. Three new diagnostic codes (`E0003`, `E0004`, `I0001`) added to the registry per Epic 1's process.
3. `tests/commands/contract.test.ts` with at least: found-annotated, found-unannotated, not-found, ambiguous.
4. Fixture: the full `refund.ts` example from Design.md §1 works end-to-end.

**Exit criteria:**

- `hewg contract payments/refund::refund` against the `refund.ts` fixture returns exactly the JSON shape from Design.md §7.2, including all six tag types.
- Total output size is under 300 tokens when tokenized with `tiktoken` using the `cl100k_base` encoding. (This is the quantitative claim Design.md §7 makes; if we can't hit it, the design assumption needs updating.)

**Risk:** Symbol lookup with three forms and good error messages is more work than it sounds. The ambiguity case (`hewg contract refund` matches multiple symbols) needs a diagnostic that lists candidates without overwhelming output. If this gets expensive, ship v0 with only the `module/path::name` form and defer the shortcuts to v0.1.

---

## Epic 4 — Built-in effect map

**Why now:** Effect propagation (Epic 5) needs the effect map to handle standard-library and common-package calls. Without it, every call to `fetch` or `fs.readFile` would be "unknown effects" and the tool would be useless on real code.

Doing this as its own epic prevents the effect map from being written badly in parallel with Epic 5's analysis. The map is data, not code; it benefits from being designed carefully once rather than extended reactively.

**Goals:**

- Coverage of Node built-ins: `fs`, `fs/promises`, `http`, `https`, `child_process`, `process`, `os`, `crypto`.
- Coverage of Web standard: `fetch`, `XMLHttpRequest`, `WebSocket`, `crypto.getRandomValues`, `localStorage`, `sessionStorage`, `console.*`.
- Coverage of top 20 npm packages by download count that have unambiguous effects: `axios`, `node-fetch`, `got`, `ky`, `pg`, `mysql2`, `redis`, `ioredis`, `mongoose`, `prisma`, `nodemailer`, `express` (routing only; the effects are on the handler), `winston`, `pino`, `dotenv`, `node-cron`, `ws`, `socket.io`, `bull`, `jsonwebtoken`.
- Extensibility: users add entries via `hewg.config.json` per Design.md §6.
- Tests verify each entry by feeding a small snippet through effect propagation (Epic 5 preview) and asserting the inferred effect row.

**Non-goals:**

- Perfect coverage. The map is best-effort; unknown calls get a configurable treatment in Epic 5.
- Scope inference (e.g. "this `fetch` is to a specific host"). v0 treats all `fetch` as `net.https` regardless of URL.
- Inferring effects from package `.d.ts` types. Interesting but hard; v2.

**Deliverables:**

1. `stdlib/effect-map.json` with entries for everything above.
2. `src/analysis/effect-map.ts` to load the JSON, merge with user config, and expose a query function `effectsOf(symbol: string): EffectName[] | undefined`.
3. `tests/effect-map.test.ts` with one test per entry confirming the mapped effects.
4. `docs/EffectMap.md` documenting every built-in entry with a one-line rationale.

**Exit criteria:**

- Every entry in the map has a test.
- `hewg.config.json` extensions correctly merge with built-ins (user entries override, not append).
- A query for `fetch` returns `["net.https"]`; a query for an unknown symbol returns `undefined`.

**Risk:** The "common npm packages" list is subjective and will never be complete. Pick the 20, document the rationale, and accept that the benchmark will reveal which additions matter. Don't chase coverage beyond this in v0.

---

## Epic 5 — Effect propagation and `hewg check` (partial)

**Why now:** With the diagnostic protocol, the parser, and the effect map in place, this epic composes them into the first real analysis. It produces `E0301` (effect not declared) — the headline diagnostic, and the one most closely tied to the thesis.

**Goals:**

- `hewg check` CLI that loads a TS project via `ts-morph`, walks every annotated function, and validates its declared `@effects` row against the union of inferred effects.
- Call-graph walk: for each call expression in a function body, resolve via TS symbol table → (a) if the target is annotated, use declared effects; (b) if unannotated but user code, recursively walk its body; (c) if in the effect map, use mapped effects; (d) otherwise emit `W0003` ("effect of callee unknown; treating as pure") by default, configurable to "treat as impure."
- Cycle detection in recursive walks.
- Depth limit (configurable, default 10) to prevent pathological compile times.
- Warnings for declared effects never observed (`E0302`).
- Warnings for declared effect rows that widen on override / implementation (`E0303` — stubbed for v0; full override analysis is v1).

**Non-goals:**

- Capability flow (Epic 6).
- Contract checking (`@pre`/`@post` — v1).
- Cost checking (v1).
- Incremental analysis / caching between runs (v0.2 if the benchmark reveals it matters).
- Cross-module effect propagation via unannotated code in node_modules (hard; treat as unknown).

**Deliverables:**

1. `src/analysis/effect-prop.ts` — the analysis pass.
2. `src/commands/check.ts` — the CLI command wiring.
3. New diagnostic codes: `W0003` (unknown effect of callee).
4. Integration test: a fixture repo with five files, mix of annotated and unannotated, produces the exact set of expected diagnostics.
5. Performance smoke test: Hewg's own source tree (which will be several hundred TS files by now) completes `hewg check` in under 10 seconds.

**Exit criteria:**

- The `audit.ts` example from Design.md §5.2 produces exactly the `E0301` diagnostic shown there, including the two ordered suggestions.
- Running `hewg check` on the `refund.ts` fixture from Design.md §1 produces zero diagnostics (it's correct as written).
- Intentionally breaking `refund.ts` by removing an effect from the row produces `E0301` with correct span.

**Risk:** Call-graph walking with unannotated user code has a performance cliff at scale. If the smoke test fails (runtime >30s on Hewg's own tree), add a depth limit (already configurable) and mark deeper calls as unknown. Do not optimize with caching in this epic — caching is Epic 9+ territory once we know what the hot path is.

---

## Epic 6 — Capability flow and `hewg check` (complete)

**Why now:** Effects are necessary but not sufficient. The second half of the thesis is capability threading: does this function call a stricter callee without having the right capabilities in scope? This epic completes `hewg check`.

**Goals:**

- For each call to an annotated function, verify that named arguments at the call site match the callee's `@cap` declarations in kind and scope.
- Scope compatibility rules: `prefix="./data/"` satisfies `prefix="./data/logs/"` (narrower scope is compatible); `host="a.com"` does not satisfy `host="b.com"`.
- Parameter-name matching: if the callee declares `@cap http net.https host=stripe.com`, the caller must pass a value named `http` at that position, and that value must be a capability of matching scope tracked back to an `@cap` in the caller.
- Diagnostics: `E0401` (scope mismatch), `E0402` (missing capability), `E0403` (capability passed as wrong parameter name).

**Non-goals:**

- Phantom-type-based capability threading (Design.md §11 explicitly flags this as v1).
- Dynamic capability construction (creating a narrower capability from a wider one via an explicit function call). v1.
- Runtime capability enforcement. Out of scope; WASI/MCP do this.

**Deliverables:**

1. `src/analysis/cap-flow.ts`.
2. Scope compatibility function with full test coverage: prefix/host/port/path rules.
3. Three new diagnostic codes with examples in the registry.
4. Fixture scenarios: (a) correctly-threaded capability, no diagnostic; (b) scope mismatch, `E0401`; (c) missing cap argument, `E0402`; (d) cap passed as wrong name, `E0403`.

**Exit criteria:**

- All four fixture scenarios produce the exact expected diagnostic output.
- `hewg check` on `refund.ts` remains clean.
- A deliberately-mistuned variant where `refund` is called with an HTTP client scoped to a different host produces `E0401` with a clear message.

**Risk:** Parameter-name-based capability matching is weak. The benchmark will reveal how often agents bypass it by renaming arguments. If the rate is high enough to invalidate experimental results, Epic 6 needs a follow-up to strengthen the check. Track this as an explicit metric in Epic 11.

---

## Epic 7 — `hewg summary` and `hewg init`

**Why now:** The full CLI surface from Design.md §7 needs to exist before the benchmark can use every command. These two are straightforward once the analyzer works.

**Goals:**

- `hewg summary <module>` — one-line summary per exported symbol, per Design.md §7.3.
- `hewg init [path]` — scaffold `hewg.config.json` in an existing TS project. Detect `tsconfig.json`, pick sensible defaults, do not modify source files.

**Non-goals:**

- `hewg callers`, `hewg impact`, `hewg fmt`, `hewg serve`. All v1.
- Interactive `init` (prompt-driven). v1.

**Deliverables:**

1. `src/commands/summary.ts`, `src/commands/init.ts`.
2. Tests for each: summary against `refund.ts` produces the exact output from Design.md §7.3; `init` on a fresh TS project produces a minimal valid config.
3. Output budget test: a module summary for `refund.ts` is under 120 tokens.

**Exit criteria:**

- All five v0 subcommands are callable: `check`, `contract`, `summary`, `init`, `version`.
- `hewg --help` lists all five with one-line descriptions.

**Risk:** Low. This is mostly glue code.

---

## Epic 8 — Dogfood and harden

**Why now:** Before measuring agents, Hewg needs to survive contact with a real codebase. The most convenient real codebase is Hewg itself. This epic is about closing the "it works on the fixtures but fails on real code" gap.

**Goals:**

- Annotate every exported function in `hewg-ts/src/` with `@effects` and `@cap` where applicable.
- Run `hewg check` on itself until it's clean.
- Fix the ten bugs this will uncover.
- Add the effect-map entries the dogfooding reveals are missing.
- Performance tuning to keep self-check under 5 seconds.
- Error message polish: anywhere a diagnostic produced a confusing message during dogfooding, improve it. This is the highest-leverage UX work in v0.

**Non-goals:**

- Annotating everything in `node_modules`. Unreasonable; also not needed — deps are walked as unknown.
- Zero warnings. Warnings about unknown callees are expected for unannotated dependencies.
- Optimizing past "fast enough." This is not the epic to build caching.

**Deliverables:**

1. All Hewg source files have `@hewg-module` headers.
2. Exported functions in `src/` have `@effects` and (where applicable) `@cap`.
3. `hewg check` on Hewg's own tree produces zero errors.
4. A `BUGS_FOUND.md` ledger with every bug uncovered during dogfooding and its fix commit.
5. A `docs/AnnotatingACodebase.md` guide written while the experience is fresh — this is Epic 10's prerequisite.

**Exit criteria:**

- `hewg check` on the Hewg repo exits 0.
- `hewg contract` on any exported Hewg symbol returns valid, useful output.
- A first-time reader could follow `docs/AnnotatingACodebase.md` to annotate a small project.

**Risk:** The project may not feel "done" after this epic. That's intentional — the remaining polish is guided by the benchmark, not by taste. If something feels wrong but is working correctly per the design, note it in `BUGS_FOUND.md` and proceed to Epic 9.

---

## Epic 9 — Benchmark harness

**Why now:** The tool is usable; time to measure. The harness is what executes the experiment from Design.md §9. This is code, not judgment; the judgment happens in Epics 10–12.

**Goals:**

- `bench/harness.ts` that runs one task across all four conditions (Design.md §9.1).
- For each condition, the harness: (a) prepares the codebase at a known git SHA in the correct annotation state; (b) constructs the system prompt appropriate to the condition; (c) invokes the model (Claude Opus 4.6 pinned) with the specified tools; (d) runs the agent loop up to the iteration/token budget; (e) applies the final patch; (f) evaluates the ground-truth signal; (g) records all metrics to a structured log.
- Three repetitions per (task, condition) with different seeds.
- All prompts, tool specs, model versions, and budgets captured in a `bench/config.json`.
- `bench/analyze.ts` computes the primary and cost metrics from harness logs and emits a report.

**Non-goals:**

- Running on multiple models (v1).
- Parallelizing across machines (use local for v0; parallelism is a v0.2 optimization).
- A dashboard. A Markdown report with a table is sufficient.

**Deliverables:**

1. `bench/harness.ts`, `bench/analyze.ts`, `bench/config.json`.
2. Tool specs as JSON files: `tools/hewg-check.json`, `tools/hewg-contract.json`, etc.
3. System prompts as Markdown files: `prompts/condition-1.md`, `prompts/condition-2.md`, etc. Per Design.md §9 these are intentionally minimal and public.
4. Test: the harness runs a trivial smoke task (e.g. "add a single-line comment to this function") across all conditions and produces a well-formed report.

**Exit criteria:**

- The smoke task runs end-to-end across all four conditions in under 15 minutes total (model latency dominates).
- The generated report contains all primary and cost metrics per Design.md §9.4.
- All inputs (prompts, tool specs, model version, budgets) are reproducible from `bench/config.json` alone.

**Risk:** API instability and rate limits. Build the harness to resume from partial logs; don't lose a three-hour run to a transient 500. The cost of one full benchmark run is a real line item — estimate before committing (~$50–200 for the full 30–50 task corpus depending on model and iterations).

---

## Epic 10 — Task corpus (10 tasks)

**Why now:** The harness works; it needs real tasks. Building a good task is surprisingly hard — each task needs a real repo, a real issue shape, a ground-truth correctness signal, and the four annotation variants of the codebase.

Starting with 10 before scaling to 30–50 is deliberate: if the first 10 don't distinguish conditions, the next 40 won't either, and scoping issues in the experiment get caught cheaply.

**Goals:**

- Ten tasks per the category weighting in Design.md §9.2: 3 effect-discovery, 2 capability-threading, 3 cross-file-edits, 1 contract-respecting, 1 null-hypothesis.
- Each task has: a real TypeScript repo pinned to a specific commit, a task description, a ground-truth done signal (passing tests, specific assertions, or a rubric).
- Each task has four codebase variants: plain, JSDoc-types-only, Hewg-annotated-without-tool, Hewg-annotated-with-tool. The last two share source; the condition varies in what tools the agent has access to, not the code.
- Annotation cost per task is measured and logged — this feeds cost metric 6.

**Non-goals:**

- All 30–50 tasks (Epic 12).
- Tasks in languages other than TypeScript.
- Rubric-based tasks (only test-based for v0; rubric scoring adds judgment variance).

**Deliverables:**

1. Ten task directories under `bench/tasks/`, each with `README.md` (task description, repo, commit, expected solution shape), `test.sh` (runs the ground-truth check), and `conditions/` with the four variants.
2. An annotated-codebase builder that takes a plain TS repo and produces the annotated version. Can be manual for v0; semi-automated in v1.
3. Total annotation effort logged in `bench/annotation-cost.md`.
4. A "task selection rationale" document explaining why each task was chosen and which Hewg mechanism it's meant to exercise.

**Exit criteria:**

- All ten tasks pass their ground-truth check when given the canonical correct solution.
- All ten tasks produce a result (success or failure) through the harness across all four conditions in under 4 hours wall-clock total.
- Annotation cost per task is under 2 hours for these small tasks (this number informs the cost threshold in Design.md §9.5).

**Risk:** Task construction is the hidden time sink of ML/AI research. Budget 2 weekends and accept that the first two tasks will take most of that time as the format solidifies. If Epic 10 runs long, fall back to 5 tasks for the first experiment (Epic 11) and add the other 5 before Epic 12.

---

## Epic 11 — First experiment (informal)

**Why now:** The field's biggest risk is spending a year running a rigorous benchmark on a broken thesis. Run ten tasks first, inspect the results, and *decide whether to continue*.

This epic is about judgment, not code. The output is a go/no-go/reframe decision.

**Goals:**

- Run the full 10-task benchmark across all four conditions, three seeds each. 120 runs total.
- Produce the report via `bench/analyze.ts`.
- Manually inspect at least 10 agent trajectories (a mix of successes and failures in condition 4) to understand what's happening mechanistically.
- Decide: proceed to Epic 12 (scale to 30–50), reframe the experiment, or abandon.

**Non-goals:**

- Publishing. The 10-task result is internal; the 30-50-task result from Epic 12 is what gets published if it lands.
- Additional model comparisons.
- Fixing the tool based on what this experiment reveals. Save that for after Epic 12; fixing during experimentation invalidates the pre-registration.

**Deliverables:**

1. `bench/results/v0-10task/` containing every run's log, the harness config, the analysis report.
2. A `DECISION.md` committed to the repo stating go/no-go/reframe, the evidence, and what shifts for Epic 12.
3. If the decision is "reframe," an updated Design.md §9 with the new experimental design.

**Exit criteria:**

- `DECISION.md` exists and is reasoned.
- If "go": Epic 12 scope is clear and the thresholds from Design.md §9.5 are unchanged.
- If "no-go": the project has a clean negative result with evidence. Write it up.
- If "reframe": the updated §9 is pre-registered before Epic 12 begins.

**Risk:** The most likely outcome is ambiguous-or-weakly-positive — suggestive gaps between conditions but within noise at n=10. Decide in advance what the "go" threshold looks like at 10 tasks: condition 4 must beat condition 2 by at least half the pre-registered threshold on at least one primary metric in at least one task category. Anything weaker is "reframe" territory, not "go."

---

## Epic 12 — Scale corpus to 30–50 and final report

**Why now:** Epic 11 produced a signal; Epic 12 produces the evidence. This is the publishable result.

**Goals:**

- Expand the task corpus from 10 to 30–50 per Design.md §9.2 category weights.
- Re-run the full benchmark across all four conditions, three seeds each.
- Apply the pre-registered thresholds from Design.md §9.5 and Design.md §9.6 to declare pass/fail/ambiguous.
- Write the final report: what was measured, how, what was found, what the limitations are, what follow-up the data suggests.
- Publish: GitHub release, blog post, arXiv submission if the result warrants, possibly LMPL workshop submission.

**Non-goals:**

- Changing the thresholds after seeing results.
- Adding conditions 5+ to explain results.
- Re-running with a different model to "see if it replicates" before the primary result is written up. Replication is follow-up work, not part of the v0 result.

**Deliverables:**

1. 30–50 tasks in `bench/tasks/`.
2. `bench/results/v0-full/` with all runs, config, report.
3. `docs/Report.md` — the writeup.
4. GitHub release `v0.1.0` with binaries and the report as release notes.
5. A public blog post summarizing the result. Honest about limitations.
6. `FUTURE.md` documenting what the data suggests for v0.2+ based on which task categories, annotations, and subcommands produced signal.

**Exit criteria:**

- Pre-registered thresholds from Design.md §9.5 applied without modification.
- Report is published.
- The repo is tagged and the experiment is reproducible from the tagged commit alone.

**Risk:** The result may be ambiguous. That's fine; say so. The value of the pre-registration is that ambiguous is a valid outcome, not a failure. The worst outcome is not ambiguity — it's p-hacking or post-hoc story-fitting to turn ambiguity into a claimed positive.

---

## Post-v0 — where the epics stop and future work begins

Everything below is explicitly out of scope for v0 and noted here only so future planning has a target to aim at. Every item is contingent on Epic 12's result.

**If v0 passes:**

- LSP server (`hewg serve`).
- Phantom-type-based capability threading.
- `hewg fmt` with canonical configuration.
- `hewg callers`, `hewg impact` subcommands.
- Cross-language experiments (`hewg check --lang=python`).
- SMT checking for `@pre`/`@post` fragments.

**If v0 is ambiguous:**

- Narrowed re-run on whichever task categories and annotations produced signal.
- Annotation-vocabulary experiments: remove one tag at a time and re-run, to isolate which contribute.

**If v0 fails:**

- A writeup is still the deliverable. The field benefits from knowing what doesn't work.
- The `hewg` tool can still be useful as a developer linter; a maintenance mode is fine.
- The team moves on to whatever the Epic 11 trajectory analysis suggested was the real bottleneck.

No epics exist past 12 because nothing past 12 is planned. The plan is to earn the next plan from Epic 12's data.

---

## Sequencing notes and explicit trade-offs

**Why the diagnostic protocol precedes any analysis.** The JSON-Lines schema is the experiment's interface. Iterating on the schema during analysis development churns downstream code and, more importantly, prevents the analysis from producing consistent output. A few specific design choices here — the `suggest[]` array shape, the distinction between `Span` and `at` for insertion points, the code registry mechanism — need to settle before Epic 5.

**Why `contract` precedes `check`.** The thesis is about information density, not enforcement. `hewg contract` delivers information density directly; `hewg check` enforces the structure that makes the contracts meaningful. If we built `check` first, the project would feel like a linter. Building `contract` first makes it a protocol-first tool, which is the right product shape.

**Why dogfooding precedes benchmarking.** Every tool that's ever been measured on external benchmarks before being used on itself has embarrassed its authors. Dogfooding catches the worst diagnostics, the slowest analyses, and the most confusing error messages while there's still time to fix them. Benchmark results from an untuned tool tell you nothing about the thesis.

**Why ten tasks before thirty-to-fifty.** Task construction is expensive and the experimental design may have subtle flaws that only show up under real data. Epic 11 is the circuit-breaker: spend one weekend to learn whether the next two weekends of task construction are worth doing. Skipping Epic 11 saves time if everything is perfect and costs a month if anything is wrong.

**What's not an epic, deliberately.** Code caching, incremental analysis, multi-model benchmarks, IDE integration, contract SMT checking, content-addressed modules. Every one of these is a natural thing a language designer would want to build. None of them test the thesis. The discipline of this plan is letting the experiment decide which of these become v1 epics and which get abandoned.

**The thing most likely to go wrong.** Epic 10 (task corpus) takes much longer than planned. Every ML research project discovers this. Mitigation: start with 5 tasks in Epic 10, run Epic 11 on 5, use the decision point to learn what makes a good task, then scale to 30–50 with better task-construction instincts. Treat the 10-task target as "10 or fewer if they're each pulling weight."

---

*End of roadmap. The next concrete commit is Epic 0: the repo skeleton. Everything else is downstream of "can you type `hewg version` and have it print something."*

*"Forged in silence, augmenting what already stands."*
