# Hewg: an annotation-based analyzer for agent-friendly TypeScript

**Author:** Collin
**Date:** 2026-04-18
**Status:** v0 proposal
**Codename:** Hewg — the blacksmith at the Roundtable Hold who augments existing weapons rather than forging new ones. The tool upgrades TypeScript in place; it does not replace it.

Every numeric or empirical claim below is marked **[evidence]** with a link, or **[inference]** when extrapolating past the evidence. Inference claims are hypotheses to test in the v0 benchmark.

---

## 0. TL;DR

Hewg is a static analyzer that reads structured JSDoc annotations from TypeScript source and enforces effect rows, capability threading, and machine-readable contracts on top of TypeScript's existing type system. It emits JSON-Lines diagnostics designed for LLM consumption and exposes `hewg contract <symbol>` to return a compact, structured signature for any annotated symbol.

The thesis it is built to test is narrow and falsifiable: **machine-readable effect, capability, and contract annotations on existing TypeScript code reduce the cost of agent software engineering by enough to justify the annotation overhead.** "Cost" is iterations-to-green, tokens-per-successful-task, and hallucinated-symbol rate. "Overhead" is the human or LLM time to annotate a codebase to the point where `hewg check` passes.

Hewg is deliberately not a new language. The 2024-2026 evidence — SWE-bench Multilingual's ~20-point penalty for leaving Python, MojoBench's demonstration that a custom-pretrained model is required to close the gap for new languages, and the broad failure of annotation systems that required their own runtime (Code Contracts, JML) — pushes strongly toward an annotation layer over a mainstream host language. TypeScript is that host because the target benchmark population (web backends, CLIs, agent tooling) is TS-heavy and because TypeScript's own semantic model is defined by its compiler's implementation, which means analyzers hosted in TypeScript avoid re-implementing `tsc`.

Hewg is a measurement tool first and a product second. Everything in this document is scoped to producing evidence for or against the thesis. If the evidence is positive, Hewg grows into a protocol that ports to other host languages; if the evidence is ambiguous, the annotation vocabulary gets refined; if the evidence is negative, the project is a clean negative result on a claim the field is otherwise hand-waving about. All three outcomes are more valuable than the current state.

---

## 1. Motivation

### 1.1 The problem Hewg addresses

Coding agents perform worse on repository-level tasks than on greenfield generation. SWE-bench Verified tops out at ~94% on Python; SWE-Bench Pro drops to 23–46% across four languages; SWE-bench Multilingual loses roughly 20 points for the same agent moving from Python to nine other languages [evidence: swebench.com, scale.com/swe-bench-pro]. Class-level real-world evaluation (arXiv:2510.26130) shows 84–89% success on synthetic benchmarks collapsing to 25–34% on real-world class-level tasks [evidence: arxiv.org/html/2510.26130]. The failure modes concentrate in three places:

1. **Hallucinated symbols**: calls to non-existent functions, imports of packages that don't exist (slopsquatting — 19.7% of LLM-recommended packages don't exist; Dark Reading, Socket.dev) [evidence: darkreading.com, socket.dev].
2. **Hidden side effects**: agents edit a "pure" helper, break production, because the language cannot tell them what the function actually does without reading its body and transitive callees.
3. **Context-window exhaustion**: a 3-line edit requires reading 20 files because the effect graph, capability dependencies, and cross-module contracts are not expressed anywhere machine-readable.

The research on mitigation converges on three mechanisms: type-directed feedback (Mündler et al., PLDI 2025 — type-constrained decoding cuts TS compile errors >50% [evidence: arxiv.org/abs/2504.09246]); compiler-loop repair (RustAssistant, ICSE 2025 — 74% fix rate on real Rust errors [evidence: microsoft.com/research]); and structured, machine-readable error protocols (Rust's `--error-format=json`, SARIF 2.1.0). All three are about giving the agent richer, more locally-actionable information.

Hewg's bet is that the richest information an agent can get about a function — short of executing it — is a structured declaration of *what it does* (effects), *what it requires* (capabilities), *what it guarantees* (contracts), and *what it costs*. TypeScript's type system expresses none of these directly. JSDoc comments with a strict grammar and a strict checker can.

### 1.2 Why not a new language

The Radahn design doc (this project's predecessor) proposed a new language targeting TypeScript. The research report that followed found three reasons the new-language path is worse than the annotation path:

- **The zero-corpus penalty is severe.** MojoBench (arXiv:2410.17736) shows that a custom-pretrained Mojo-Coder beats frontier models by 30–35% on its own HumanEval port — because the frontier models simply do not know Mojo [evidence: arxiv.org/abs/2410.17736]. Transpile-to-TS languages (ReScript, PureScript, Elm) have 3,000–10,000× less adoption than TypeScript [evidence: npmtrends.com].
- **The effect-system-as-grammar bet has weak industrial evidence.** OCaml 5 shipped algebraic effect handlers with *no* effect type system, because retrofitting row polymorphism onto HM inference was intractable [evidence: ocaml.org/releases/5.3.0]. Koka, Unison, Austral, Effekt remain research-only. Meanwhile runtime capability enforcement (WASI, Deno, MCP, Microsoft Agent Governance Toolkit) is the load-bearing agent-safety layer in production.
- **The benefit an agent gets from Radahn is almost entirely information density, not grammar-level unbypassability.** A `hewg contract` response that returns 200 tokens of structured signature instead of 2,000 tokens of function body is the win. That win is identical whether the annotations live in comments or in grammar.

An annotation system gets the information-density benefit, runs against unmodified real codebases, and does not pay the corpus penalty. If the annotation experiment succeeds, grammar-level enforcement becomes a question to re-open — but only if the data shows annotations failing at a specific enforcement problem grammar could solve, and the research suggests that is unlikely to be what emerges.

### 1.3 Why not rely on runtime capabilities alone

WASI, Deno permissions, MCP gateways, and the Microsoft Agent Governance Toolkit (April 2026) handle the runtime capability-enforcement story completely. If safety were the goal, Hewg would be unnecessary.

Hewg's goal is not runtime safety. It is *agent-time auditability and information density*. The runtime stops an agent's code from exfiltrating data; Hewg stops an agent from writing code that surprises it at review time. Those are distinct problems with complementary solutions.

---

## 2. Thesis, measured

The thesis sentence, restated:

> Machine-readable effect, capability, and contract annotations on existing TypeScript code materially reduce the cost of agent software engineering, at a magnitude that justifies the annotation overhead.

Every word does work:

- **Machine-readable**: consumable by `hewg check` and `hewg contract`, not just human documentation.
- **Effect, capability, and contract annotations**: the specific trio, not generic documentation. Testing annotations-generically is trivially true and uninteresting.
- **Existing TypeScript code**: real repositories with real dependencies and real ambient IO, not toy examples.
- **Cost of agent software engineering**: iterations, tokens, hallucinated-symbol rate, not task capability.
- **Magnitude that justifies overhead**: the annotation cost must be recouped by the iteration savings. This is where Code Contracts failed for .NET and where Hewg has to be honest.

### 2.1 What Hewg is NOT testing

- **Not**: "agents write better code in a new language than TypeScript." (The language was dropped.)
- **Not**: "annotations make code safer." (Safety is a runtime concern.)
- **Not**: "effect systems are the right PL abstraction." (Out of scope; unsettled in the research.)
- **Not**: "content-addressed modules help agent retrieval." (Out of scope for v0; revisit only if the primary thesis survives.)

### 2.2 How it will be measured

See §9 for the full experimental design. The short version: four conditions (plain TS, TS+JSDoc types, TS+Hewg annotations without the tool, TS+Hewg annotations with the tool), 30–50 real tasks on real repositories, five primary metrics (task success rate, iterations-to-green, tokens-per-success, hallucinated-symbol rate, effect-violation rate in produced patches), and two cost metrics (annotation time and annotation maintenance burden). Pre-registered thresholds for thesis-passes, thesis-fails, and thesis-ambiguous outcomes.

---

## 3. Design principles

The design falls out of §1 and §2:

1. **Zero runtime footprint.** Hewg annotations are JSDoc comments. Remove them and the code compiles and runs identically. No `@hewg/caps` import, no branded types polluting signatures, no generated code. Pure analysis, RuboCop-style.
2. **The annotation is the source of truth.** There is no redundant type-level expression of the same information. One comment, one checker, one mental model.
3. **The tool runs against unmodified codebases.** `npx hewg check` on any existing TypeScript project produces meaningful output on day one, because Hewg ships with a built-in effect map for standard library and common packages.
4. **JSON-Lines diagnostics are the product.** The human-pretty output is a pretty-printer over the JSON, not the other way around. Every diagnostic has a stable code, span, severity, suggestion array, and docs URL.
5. **Subcommands expose a protocol, not a UI.** `hewg check`, `hewg contract`, `hewg summary`, `hewg init`, `hewg version`. Each command is a tool-call target an agent can invoke. The output is structured.
6. **TypeScript hosts the analyzer.** Analyzing TypeScript requires matching `tsc`'s semantic model. Hosting in TypeScript uses `ts-morph` to get that model for free. Hosting elsewhere means reimplementing it.
7. **Bounded vocabulary in v0.** Six annotations (`@hewg-module`, `@effects`, `@cap`, `@pre`, `@post`, `@cost`). No `@version`, no `@since`, no `@summary`. Add only when data says a tag is missing.
8. **Pre-registered evaluation.** The benchmark, conditions, metrics, and pass/fail thresholds are committed to the repo before the first experiment runs. This is what separates Hewg from the usual "we tried a thing and it seemed to help" PL paper.

---

## 4. Annotation vocabulary

Six tags. Every tag attaches to an exported declaration via a JSDoc block immediately preceding it.

### 4.1 `@hewg-module <path>`

One per file. Declares the module's logical path. Does not have to match the file path in v0 — it is a name the `hewg contract` and `hewg summary` commands use for lookup.

```typescript
/**
 * @hewg-module payments/refund
 */
```

### 4.2 `@effects <effect, effect, ...>`

Declares the effect row for a function. Absence means "pure" — no side effects, no IO, no non-determinism. Effects are dot-separated lowercase names drawn from a built-in vocabulary:

- `net.http`, `net.https`, `net.tcp`, `net.udp`
- `fs.read`, `fs.write`, `fs.exec`
- `proc.spawn`, `proc.env`, `proc.exit`
- `time.read`, `time.sleep`
- `rand`
- `log`

Projects may extend the vocabulary in `hewg.config.json` with dotted names of their own (e.g. `db.write`, `queue.publish`).

```typescript
/**
 * @effects net.https, fs.write, log
 */
```

An effect row on a function must be a superset of the union of effect rows of every callee (after resolving calls via TypeScript's symbol table, walking into callee bodies when they are unannotated, and consulting the built-in effect map for standard-library and known-package calls). Mismatch is diagnostic **E0301** (§5.2).

### 4.3 `@cap <name> <kind> [scope...]`

Declares that a specific parameter of the function is a capability of a given kind, scoped to given resources. The `<name>` must match a parameter name in the TypeScript signature. The `<kind>` is drawn from the same effect vocabulary. The scope is key-value pairs specific to the kind.

```typescript
/**
 * @cap http  net.https  host="api.stripe.com" port=443
 * @cap fs    fs.write   prefix="./receipts/"
 * @cap log   log
 */
```

Scope semantics:

- `net.*`: `host`, `port`, optional `path_prefix`.
- `fs.*`: `prefix` (path prefix the capability is authorized for).
- `proc.*`: `cmd_allowlist` (list of allowed commands for `spawn`).
- `time.*`, `rand`, `log`: no scope fields in v0.

When a function `A` calls a function `B` that declares `@cap http net.https host="api.stripe.com"`, the analyzer requires `A` to pass as its `http` argument a value that either (a) has a `@cap` declaration in `A` with compatible scope, or (b) is constructed from such a value via an identity pass-through. Mismatch is diagnostic **E0401** (§5.2).

v0 capability checking is parameter-name-based. This is deliberately weaker than phantom-type-based capability threading would be — it's the simplest thing that tests the thesis. If the benchmark shows the check is too permissive (agents bypass it by passing wrong-scope values), v1 can strengthen it.

### 4.4 `@pre <expression>`

A precondition expression evaluated at the call site. Expressions are TypeScript expressions referencing parameters of the function; they are parsed but not statically verified in v0.

```typescript
/**
 * @pre amountCents > 0
 * @pre chargeId.length === 18
 */
```

In v0 the analyzer records preconditions and exposes them via `hewg contract`. It does not check them. v1 would add SMT-backed checking for the subset of predicates expressible as linear arithmetic and string-length constraints. This matches the Liquid Haskell / Dafny tradition — parse first, check second — and defers the hard error-message engineering problem to when the thesis is proven.

### 4.5 `@post <expression>`

A postcondition expression. The distinguished identifier `result` refers to the function's return value. For `Result`-typed returns, `result.ok` and `result.val` are conventionally-named projections.

```typescript
/**
 * @post result.ok => exists_receipt_file(result.val.id)
 */
```

Same v0/v1 story as `@pre`: parsed, exposed, not checked.

### 4.6 `@cost <field>=<value> <field>=<value> ...`

Cost hints. Space-separated key-value pairs. The v0 recognized keys are:

- `tokens=<number>`: approximate token count of the function body (advisory).
- `ops=<number|~number>`: approximate operation count.
- `net<=<number>`, `fs<=<number>`, `proc<=<number>`: upper bounds on effect-specific operations.
- `time<=<duration>`: upper bound on wall-clock time. Duration format: `5s`, `250ms`, `1m`.

```typescript
/**
 * @cost tokens=120 ops=~6 net<=3 time<=5s
 */
```

Unrecognized keys are preserved verbatim in `hewg contract` output and emit warning **W0001**. The cost layer is deliberately advisory in v0 — it tests whether agents *consume* structured cost info, not whether the tool enforces it.

### 4.7 Lint-only tags reserved for v1+

Not implemented in v0 but reserved to prevent collision with user JSDoc tags: `@hewg-version`, `@hewg-since`, `@hewg-summary`, `@hewg-unsafe`, `@hewg-impure`.

---

## 5. The checker

### 5.1 Architecture

`hewg check` runs five passes:

1. **Project load.** `ts-morph` loads the project via `tsconfig.json`, producing a fully type-checked program. This pass is where Hewg inherits all of TypeScript's semantic analysis for free.
2. **Annotation parse.** For every exported declaration, Hewg reads the attached JSDoc block and parses known `@hewg-*`, `@effects`, `@cap`, `@pre`, `@post`, `@cost` tags. Malformed tags emit **E0201** (§5.2). Unknown `@hewg-*` tags emit **W0002**.
3. **Call-graph effect propagation.** Hewg walks every function's body, resolves each call expression via the TypeScript symbol table, and accumulates the effect row for each function. Unannotated callees inherit their body's effects transitively (with a depth limit and cycle detection). Calls to symbols in the built-in effect map contribute their mapped effects. The result is an *inferred* effect row per function.
4. **Effect-row check.** For every annotated function, inferred effects must be a subset of declared effects. Violations emit **E0301**.
5. **Capability-flow check.** For every call to an annotated function, the caller's named arguments matching `@cap` parameters must have scope at least as permissive as the callee requires. Violations emit **E0401**.

Parses are fast because `ts-morph` is fast; the dominant cost is pass 3, which scales with the call graph. A 500-file project with a moderate call graph completes in 1–3 seconds on a typical developer laptop [inference].

### 5.2 Diagnostic schema

Every diagnostic is one JSON object on one line:

```json
{
  "code": "E0301",
  "severity": "error",
  "file": "src/audit.ts",
  "line": 6,
  "col": 23,
  "len": 11,
  "message": "call to `fs.readFile` performs effect `fs.read`, not declared in @effects `log`",
  "related": [
    {"file": "src/audit.ts", "line": 3, "col": 13, "len": 3, "message": "effect row declared here"}
  ],
  "suggest": [
    {"kind": "add-effect", "rationale": "declare the effect", "at": {"file": "src/audit.ts", "line": 3, "col": 16, "len": 0}, "insert": ", fs.read"},
    {"kind": "add-cap", "rationale": "thread an Fs.Read capability from the caller", "at": {"file": "src/audit.ts", "line": 4, "col": 1, "len": 0}, "insert": " * @cap fs fs.read prefix=\"./receipts/\"\n"}
  ],
  "docs": "https://hewg.dev/e/0301"
}
```

Fields:

- `code`: stable string from the registry. Letter prefix indicates category: `E` error, `W` warning, `I` info, `H` help.
- `severity`: `error`, `warning`, `info`, `help`.
- `file`, `line`, `col`, `len`: 1-indexed source span.
- `message`: single-line summary, human-readable.
- `related` (optional): additional labeled spans.
- `suggest` (optional): ordered array, first is most actionable. Each entry has `kind`, `rationale`, `at` (a full span), and `insert` (the text to insert).
- `notes` (optional): supplementary prose explanation.
- `docs`: URL to the human reference page.

### 5.3 Code registry

v0 reserves the following code ranges:

- `E0001–E0099`: ingest errors (couldn't find tsconfig, file read failed, etc.)
- `E0201–E0299`: annotation syntax errors
- `E0301–E0399`: effect-row errors
- `E0401–E0499`: capability-flow errors
- `E0501–E0599`: contract-clause errors (parse only in v0)
- `W0001–W0099`: advisory warnings
- `I0001–I0099`: informational
- `H0001–H0099`: fix-it hints

Concrete v0 codes:

| Code | Meaning |
|---|---|
| `E0001` | tsconfig not found |
| `E0002` | file read error |
| `E0201` | malformed annotation tag |
| `E0202` | `@cap` references non-existent parameter |
| `E0301` | effect not declared in `@effects` |
| `E0302` | declared effect never used (warning) |
| `E0303` | effect row widening in override |
| `E0401` | capability scope mismatch |
| `E0402` | missing capability at call site |
| `E0403` | capability passed as wrong parameter name |
| `E0501` | malformed `@pre`/`@post`/`@cost` expression |
| `W0001` | unknown `@cost` field |
| `W0002` | unknown `@hewg-*` tag |

The registry lives at `src/diag/codes.ts`. Adding a code requires: reserving the number, adding a `DiagnosticInfo` entry, adding an example to `src/diag/examples.ts`, and writing a docs page. The test `tests/diag.test.ts` fails if any of these are missing — the same mechanism the Radahn design used.

### 5.4 Output formats

- `hewg check` (default): human-pretty output, one block per diagnostic with file:line:col, message, underlined source span, and suggestions.
- `hewg check --json`: JSON-Lines, one diagnostic per line.
- `hewg check --sarif`: SARIF 2.1.0 output for GitHub Advanced Security and other security-tool integrations. This is v0.1, not day-zero, but pre-registered.

---

## 6. The built-in effect map

This is how Hewg works on unmodified codebases. A curated TypeScript table maps symbols from the TypeScript standard library and common npm packages to their effect rows. Structure:

```typescript
export const EFFECT_MAP: EffectMap = {
  "fetch": { effects: ["net.https"] },  // assume https for v0
  "node:fs.readFile": { effects: ["fs.read"] },
  "node:fs.writeFile": { effects: ["fs.write"] },
  "node:fs/promises.readFile": { effects: ["fs.read"] },
  "node:child_process.spawn": { effects: ["proc.spawn"] },
  "Date.now": { effects: ["time.read"] },
  "Math.random": { effects: ["rand"] },
  "console.log": { effects: ["log"] },
  "console.error": { effects: ["log"] },
  // ...
};
```

v0 ships coverage for:

- Node built-ins: `fs`, `fs/promises`, `http`, `https`, `child_process`, `process`, `os`, `crypto` (for `randomBytes` etc.).
- Web standard: `fetch`, `XMLHttpRequest`, `WebSocket`, `crypto.getRandomValues`, `localStorage` (→ `fs.read`/`fs.write` in browser context), `console.*`.
- Common npm: `axios`, `node-fetch`, `got`, `ky`, `pg`, `mysql2`, `redis`, `ioredis`, `mongoose`.

Users extend the map via `hewg.config.json`:

```json
{
  "effectMap": {
    "my-internal-logger.log": { "effects": ["log"] },
    "./src/db/client.query": { "effects": ["net.tcp", "log"] }
  }
}
```

For packages where most methods are pure (utility libraries, ORMs with only a few effectful methods), use per-package trust instead of mapping every method:

```json
{
  "packages": {
    "ts-morph": { "defaultPolicy": "pure" },
    "lodash": { "defaultPolicy": "pure" },
    "pg": { "defaultPolicy": "warn" }
  },
  "check": {
    "defaultPackagePolicy": "pure"
  }
}
```

The resolution priority is: explicit effect map entry → per-package policy → `defaultPackagePolicy` → global `unknownEffectPolicy`. This lets you trust the long tail of utility packages while keeping enforcement on the IO-heavy ones that matter.

Maintaining the map is the ongoing-maintenance cost of Hewg. An imperfect map is better than no map in v0; the benchmark will reveal how often the imperfections matter.

---

## 7. Subcommands

Five commands in v0. Each is a tool-call surface an agent can invoke. Stable names, stable output shapes.

### 7.1 `hewg check [path...]`

Run the analyzer. Default output human-pretty; `--json` for JSON-Lines; `--sarif` for SARIF 2.1.0. Exit code 0 if no errors, 1 if any errors, 2 if the checker itself failed.

### 7.2 `hewg contract <symbol>`

Return the structured contract for one symbol. Output is JSON:

```json
{
  "symbol": "payments/refund::refund",
  "signature": "(http: HttpClient, fs: FsWriter, log: Logger, chargeId: ChargeId, amountCents: number) => Promise<Result<RefundReceipt, RefundError>>",
  "effects": ["net.https", "fs.write", "log"],
  "caps": {
    "http": {"kind": "net.https", "host": "api.stripe.com", "port": 443},
    "fs":   {"kind": "fs.write",  "prefix": "./receipts/"},
    "log":  {"kind": "log"}
  },
  "pre":  ["amountCents > 0"],
  "post": ["result.ok => exists_receipt_file(result.val.id)"],
  "cost": {"tokens": 120, "ops": "~6", "net": "<=3", "time": "<=5s"},
  "errors": ["NotFound", "Upstream"],
  "source": {"file": "src/payments/refund.ts", "line": 24}
}
```

~200 tokens per symbol, typically. This is the command that gives agents information density.

Symbol lookup accepts multiple forms: `payments/refund::refund` (module path + name), `src/payments/refund.ts:refund` (file path + name), `refund` (name only, errors if ambiguous).

### 7.3 `hewg summary <module>`

One-line summary per exported symbol in a module.

```
$ hewg summary payments/refund
module payments/refund  (file: src/payments/refund.ts)
  effects: net.https, fs.write, log

exports:
  refund(http, fs, log, chargeId, amountCents) => Promise<Result<RefundReceipt, RefundError>>
      effects: net.https, fs.write, log
      caps:    http@stripe.com:443, fs@./receipts/, log
      pre:     amountCents > 0
      cost:    ~120 tok, ~6 ops, <=3 net, <=5s
  type RefundError    — 2 variants (NotFound, Upstream)
  type RefundReceipt  — 3 fields
```

~80 tokens for a module summary. An agent loading this instead of the file body saves 10–20× on context for the module.

### 7.4 `hewg init [path]`

Scaffold `hewg.config.json` in a TypeScript project. Detects `tsconfig.json`, picks sensible defaults, writes a minimal config. Does *not* modify source files.

### 7.5 `hewg version`

Print version and platform. Trivial but expected.

### 7.6 Subcommands reserved for later

Pre-registered so the name doesn't get squatted and so scope is clear:

- `hewg callers <symbol>` — return all annotated callers. v0.2.
- `hewg impact <diff>` — given a proposed patch, return symbols whose contracts change. v0.3.
- `hewg fmt` — run `prettier` with Hewg's canonical config. v1.
- `hewg serve` — run as an LSP server for editor integration. v1.
- Cross-language subcommands (`hewg check --lang=python`). v2, contingent on thesis success.

---

## 8. Project layout and stack

```
hewg-ts/
├── package.json
├── tsconfig.json
├── bunfig.toml
├── hewg.config.json         # dogfooded
├── README.md
├── src/
│   ├── cli.ts               # entry + subcommand dispatch
│   ├── config.ts            # hewg.config.json loader
│   ├── project.ts           # ts-morph project loader
│   ├── annotations/
│   │   ├── parser.ts        # JSDoc tag → typed annotation
│   │   └── types.ts         # Annotation, EffectRow, Capability, Contract
│   ├── analysis/
│   │   ├── effect-map.ts    # built-in effect table
│   │   ├── effect-prop.ts   # call-graph effect propagation
│   │   └── cap-flow.ts      # capability scope checking
│   ├── diag/
│   │   ├── types.ts         # Diagnostic, Span, Suggestion
│   │   ├── codes.ts         # registry
│   │   ├── examples.ts      # one example per code
│   │   └── render.ts        # human-pretty + JSON + SARIF
│   └── commands/
│       ├── check.ts
│       ├── contract.ts
│       ├── summary.ts
│       ├── init.ts
│       └── version.ts
├── stdlib/
│   └── effect-map.json      # default effect map, ships with the binary
├── tests/
│   ├── annotations.test.ts
│   ├── effect-prop.test.ts
│   ├── cap-flow.test.ts
│   ├── diag.test.ts         # fails if any code lacks an example
│   └── fixtures/            # small .ts files with expected diagnostics
└── bench/
    ├── README.md            # the experimental design (§9)
    ├── tasks/               # 30-50 real tasks
    ├── harness.ts
    └── analyze.ts           # produces the pre-registered report
```

**Stack:**

- **Runtime:** Bun primary, Node 20+ secondary. `bun build --compile` for distribution.
- **TypeScript analysis:** `ts-morph` (wraps the TypeScript Compiler API).
- **JSDoc parsing:** TypeScript's built-in `ts.getJSDocTags` plus a thin custom layer for Hewg's tag grammar.
- **CLI:** `cac` for subcommand dispatch.
- **Testing:** `bun test`.
- **Distribution:** npm package with `bin/hewg`, prebuilt native binaries for macOS/Linux/Windows x64 and arm64 via `bun build --compile`, pure-JS fallback.

v0 LOC budget: ~2,500 lines of TypeScript. Timeline: 3–4 weekends to a working checker, plus 2 weekends for the benchmark harness and first task corpus.

---

## 9. The experiment

This section is load-bearing. Hewg is a measurement tool; this is what it measures. Everything below is pre-registered in `bench/README.md` before the first experiment runs.

### 9.1 Conditions

Four conditions, not three:

1. **Plain TypeScript.** Baseline.
2. **TS + JSDoc types.** Controls for "any annotation helps." The agent sees parameter and return types in comments, nothing else.
3. **TS + Hewg annotations, no tool.** The agent can read Hewg-style JSDoc tags in context but cannot invoke `hewg check` or `hewg contract`.
4. **TS + Hewg annotations + tool access.** Full thesis. The agent has `hewg check` and `hewg contract` as tools.

The comparison that matters most is **4 vs. 3** (tool value) and **4 vs. 2** (annotations-plus-tool value above generic annotation value). 4 vs. 1 is interesting for communication but not for the thesis.

### 9.2 Task corpus

30–50 tasks on real TypeScript repositories. Mix of:

- Small/medium open-source libraries: `ky`, `hono`, `zod`, `vitest` (as a user, not a contributor), a small Express app.
- Mid-size internal-shape projects simulated from real code.
- One large monorepo-shaped project (test behavior at scale).

Task categories, weighted for the effect/capability/contract thesis:

- **Effect-discovery tasks** (~30%): "Add retry logic without introducing new side effects." "This function should be idempotent; refactor accordingly."
- **Capability-threading tasks** (~20%): "Make this function testable by injecting X." "Split this into a pure core and an IO shell."
- **Cross-file edits** (~25%): "Add a new error variant and handle it at every call site."
- **Contract-respecting edits** (~10%): "Optimize this preserving its postconditions."
- **Null-hypothesis tasks** (~15%): Pure algorithmic refactors within one function, where annotations should not help. Guards against measuring "the annotated variant gave the agent more context in general."

Every task has a ground-truth done signal: tests pass, specific assertions hold, or a scored rubric evaluated by a held-out model.

### 9.3 Model and harness

- **Model:** Pinned to a specific version (Claude Opus 4.6 or equivalent at time of run). Pinned for the full experiment. Any model change invalidates results and the experiment re-runs.
- **Iteration budget:** 20 agent turns per task.
- **Token budget:** 200k total per task.
- **Agent scaffold:** Minimal. System prompt mentions available tools; no elaborate instructions. Public prompt text published with results.
- **Randomness:** Each task run 3 times per condition with different seeds; reported as mean ± 95% CI.

### 9.4 Metrics

Primary (thesis-testing):

1. **Task success rate.** Fraction of tasks completed within budget.
2. **Iterations to green.** On successful tasks, edit-check-diagnose cycles.
3. **Tokens per successful task.** Total input + output across all turns.
4. **Hallucinated-symbol rate.** Count of non-existent imports/calls/identifiers per task.
5. **Effect-violation rate in produced patches.** Does the final patch declare effects consistent with its behavior? (Measurable because Hewg can check.)

Cost (overhead-testing):

6. **Annotation cost.** Minutes (or tokens) per kloc to annotate a previously unannotated codebase to the point where `hewg check` passes.
7. **Annotation maintenance burden.** Over N subsequent agent edits, how often do annotations need updating, and how often does the agent get it right unassisted.

### 9.5 Pre-registered thresholds

Stated here, in the design doc, to prevent goalpost-moving after data arrives.

**Thesis passes** if condition 4 beats condition 2 by:

- ≥10 percentage points on task success rate, OR
- ≥25% reduction in iterations to green, OR
- ≥30% reduction in tokens per success

on the effect-sensitive and cross-file task categories, AND annotation cost is recouped within 5 subsequent agent edits per annotated function.

**Thesis fails** if condition 4 is within 5 points of condition 2 on all primary metrics across all task categories.

**Ambiguous** is anything in between. Ambiguous is the likely outcome and is where the interesting follow-up designs live (narrower product scope, different annotation vocabulary, etc.).

### 9.6 What the outcomes encourage

- **Thesis holds.** Publish. Ship v1 with LSP integration, expanded annotation vocabulary guided by which tags drove the result, and cross-language experiments.
- **Thesis fails.** Publish. The annotation+tool path does not move the needle beyond generic types; the field's leverage is elsewhere (scaffolds, retrieval, runtime sandboxing). Save everyone a year.
- **Thesis ambiguous.** Narrow and re-run. The data will show which specific task categories, which specific annotations, and which specific subcommands produced signal. v0.2 re-runs with a narrower scope against the 2 or 3 places the effect was real.

All three outcomes are more valuable than the field's current state, which is consensus-by-hand-waving that agents need richer-than-types information. Hewg's job is to produce evidence.

---

## 10. What v0 does NOT include

Pre-registered non-goals to prevent scope drift:

- **A new language or grammar.** Full stop. If follow-up data specifically identifies an enforcement failure that grammar could fix, the v2 design doc addresses it then.
- **Content-addressed symbol identity.** The Unison bet is interesting but orthogonal to the thesis. If Hewg succeeds, v2 might expose content hashes via `hewg contract`. Not now.
- **Runtime enforcement.** WASI, Deno permissions, MCP brokers handle this. Hewg is compile-time / agent-time only.
- **Refinement-type checking.** `@pre` and `@post` are parsed but not checked in v0. v1 might add SMT for linear arithmetic and string-length fragments. The error-message engineering cost is real (Liquid Haskell cautionary tale); defer until the base thesis is proven.
- **LSP / IDE integration.** v1. The v0 CLI is the full product surface for the experiment.
- **Cross-language support.** v2, contingent on thesis results.
- **Formatter (`hewg fmt`).** v1. `prettier` is good enough for v0.
- **`@version`, `@since`, `@summary` tags.** Add when data says they're missing.
- **Package-registry hygiene for slopsquatting.** Adjacent problem, different tool.
- **Multi-model or cross-model benchmarks.** v0 pins one model. Portability is v1.

---

## 11. Risks and honest caveats

**Effect-map completeness.** Hewg's accuracy on unmodified codebases is bounded by the coverage of its built-in effect map. An incomplete map will produce either false negatives (agents think code is pure when it isn't) or spurious "unknown effects" warnings (noise that degrades usability). The benchmark will reveal this; mitigation is ongoing map curation plus a `@hewg-impure` escape hatch for the long tail.

**Parameter-name-based capability threading is weak.** v0's capability check compares argument names at call sites. A motivated agent can bypass it with renaming. The benchmark measures how often this matters in practice. If it's often, v1 needs phantom-type-based threading (which costs ecosystem friction) or runtime wrappers (which cost runtime footprint).

**Benchmark tasks are expensive to build.** 30–50 real tasks with ground-truth correctness signals is weeks of work. Undersized task corpora will produce noisy results and weak conclusions. Budget accordingly.

**Prompt-engineering confound.** Condition 4's system prompt must describe the available tools; conditions 1–3 cannot. This is a real confound. Mitigations: minimally-instructive prompts across all conditions ("you have these tools; figure out when"), public prompt text, and a second reporting pass that evaluates condition 4 with a deliberately tool-sparse prompt to bound the prompt contribution.

**Model drift.** Frontier models update frequently. A result on Claude Opus 4.6 may not replicate on 4.7. Mitigation: pin version, document exactly, be willing to re-run.

**Annotation-honesty assumption.** The thesis assumes annotations describe what the code does. If agents write inconsistent annotations and the checker misses them, the experiment measures something weaker than the thesis. Mitigation: metric 5 (effect-violation rate in produced patches) directly measures this; a high rate in condition 4 invalidates the cleaner interpretations of the result.

**Cross-sectional vs. longitudinal benefit.** The v0 benchmark measures single-task performance. The real-world claim ("annotations are worth the maintenance burden over a codebase's lifetime") requires longitudinal data Hewg v0 cannot produce. Be honest about this in writeups.

---

## 12. Sources

Primary sources are marked **[primary]**; secondary/synthesis **[secondary]**.

- [swe-multilingual]: **[primary]** SWE-bench Multilingual leaderboard and methodology. <https://www.swebench.com/multilingual.html>
- [swe-pro]: **[primary]** Scale AI, SWE-Bench Pro. <https://static.scale.com/uploads/654197dc94d34f66c0f5184e/SWEAP_Eval_Scale%20(9).pdf>
- [multi-swe-bench]: **[primary]** Zan et al., "Multi-SWE-bench: A Multilingual Benchmark for Issue Resolving," arXiv:2504.02605, NeurIPS 2025 D&B. <https://arxiv.org/abs/2504.02605>
- [swe-polybench]: **[primary]** Amazon, "SWE-PolyBench," arXiv:2504.08703. <https://arxiv.org/abs/2504.08703>
- [class-level]: **[primary]** "Beyond Synthetic Benchmarks: Evaluating LLM Performance on Real-World Class-Level Code Generation," arXiv:2510.26130. <https://arxiv.org/abs/2510.26130>
- [type-constrained]: **[primary]** Mündler et al., "Type-Constrained Code Generation with Language Models," PLDI 2025 / PACMPL. <https://arxiv.org/abs/2504.09246>
- [rust-assistant]: **[primary]** Deligiannis et al., "RustAssistant," arXiv:2308.05177, ICSE 2025. <https://arxiv.org/abs/2308.05177>
- [agentless]: **[primary]** Xia et al., "Agentless: Demystifying LLM-based Software Engineering Agents," arXiv:2407.01489. <https://arxiv.org/abs/2407.01489>
- [repograph]: **[primary]** "RepoGraph: Enhancing AI Software Engineering with Repository-level Code Graph," arXiv:2410.14684, ICLR 2025. <https://arxiv.org/abs/2410.14684>
- [mojobench]: **[primary]** "MojoBench: Language Modeling and Benchmarks for Mojo," arXiv:2410.17736. <https://arxiv.org/abs/2410.17736>
- [slopsquat-paper]: **[primary]** "We Have a Package for You! A Comprehensive Analysis of Package Hallucinations by Code Generating LLMs," arXiv:2406.10279.
- [slopsquat-industry]: **[secondary]** "AI Code Tools Widely Hallucinate Packages," Dark Reading. <https://www.darkreading.com/application-security/ai-code-tools-widely-hallucinate-packages>
- [vericoding]: **[primary]** "A benchmark for vericoding: formally verified program synthesis," arXiv:2509.22908.
- [power-of-10]: **[primary]** Holzmann, "The Power of Ten — Rules for Developing Safety Critical Code," NASA/JPL 2006. <https://spinroot.com/gerard/pdf/P10.pdf>
- [cyclo-critique]: **[primary]** Shepperd, "A Critique of Cyclomatic Complexity as a Software Metric."
- [koka]: **[primary]** Leijen, "Koka: Programming with Row-polymorphic Effect Types." <https://arxiv.org/pdf/1406.2061>
- [effekt]: **[primary]** Brachthäuser, Schuster, Ostermann, "Effekt: Capability-passing style for type- and effect-safe, extensible effect handlers in Scala," JFP 2020.
- [unison]: **[primary]** Unison abilities. <https://www.unison-lang.org/docs/language-reference/abilities-and-ability-handlers/>
- [austral]: **[primary]** Borretti, "Introducing Austral: A Systems Language with Linear Types and Capabilities." <https://borretti.me/article/introducing-austral>
- [ocaml-5-3]: **[primary]** OCaml 5.3 release notes. <https://ocaml.org/releases/5.3.0>
- [anthropic-agents]: **[secondary]** Anthropic, "Building Effective Agents," Dec 2024.
- [cognition-multiagent]: **[secondary]** Cognition, "Don't Build Multi-Agents," June 2025. <https://cognition.ai/blog/dont-build-multi-agents>
- [ai-agentic-survey]: **[primary]** "AI Agentic Programming: A Survey of Techniques, Challenges, and Opportunities," arXiv:2508.11126.
- [json-vs-xml]: **[secondary]** Aider, "Coding with LLMs in JSON." <https://aider.chat/2024/08/14/code-in-json.html>
- [let-me-speak]: **[primary]** "Let Me Speak Freely? A Study on the Impact of Format Restrictions on Performance of Large Language Models," arXiv:2408.02442.
- [ts-morph]: <https://github.com/dsherret/ts-morph>
- [sarif]: SARIF 2.1.0 specification. <https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html>

---

*End of document. Next concrete steps, in order:*

*(a) scaffold the `hewg-ts` repo per §8;*
*(b) implement the annotation parser and diagnostic schema (§4, §5.2) first, before any analysis code;*
*(c) implement `hewg contract` before `hewg check` — the contract command is the thesis, the check command is the enforcement;*
*(d) build the effect map (§6) in parallel with the effect-propagation pass (§5.1);*
*(e) write the benchmark harness and first 10-task corpus per §9 as the next milestone;*
*(f) run one informal task against one real open-source repo before investing in the full 30-50 task corpus — if one task shows nothing, the larger harness will not rescue it.*

*"Forged in silence, augmenting what already stands."*
