# Annotating a codebase with Hewg

A practical guide for adding `@effects` and `@cap` annotations to an existing TypeScript project. Written while dogfooding Hewg on its own source tree (see `BUGS_FOUND.md` for what that surfaced).

## 1. What you're signing up for

Hewg reads JSDoc tags — `@hewg-module`, `@effects`, `@cap`, `@pre`, `@post`, `@cost` — on exported functions, and at `hewg check` time reconciles them with what the call graph actually does. The two tags that carry most of the value are:

- **`@effects`** — what side effects this function (transitively) performs: reads/writes, network, logging, process env, randomness. Use `@effects` with nothing after it to mean "this function is pure." Use `@effects fs.read, log` to list one or more effects.
- **`@cap`** — which capability parameter the caller must thread through to permit an effect. Capabilities are Hewg's way of saying "the function body does this, but only if the caller passes in permission to do it."

The usable mental model:

> **Effects declare what a function does. Capabilities declare what it's allowed to do, parameterized on its caller.**

Two rules of thumb that will save you rework:

1. **Annotate effects top-down, capabilities bottom-up.** Start by marking your pure leaves. Climb toward entry points. Caps work the other way: declare `@cap` on the leaf that actually performs the effect, then thread the same-named parameter through callers.
2. **Pure is the default, but you have to say so.** Bare `@effects` (no list) is how you mark a function as pure. This is what flips the contract from `effects: null` (unknown) to `effects: []` (declared empty).

## 2. Before you start

```sh
# in your project root
hewg init
```

That drops a `hewg.config.json` with `{ "check": { "depthLimit": 10, "unknownEffectPolicy": "warn" } }`. Key decisions:

- **`unknownEffectPolicy`** — `warn` (default) or `pure`. `warn` emits W0003 for every callee that's not in the effect map; `pure` silently treats unknowns as pure. Keep `warn` for a new codebase — the noise is informative. Switch to `pure` only on a mature tree where you've already triaged the unknown surface.
- **`defaultPackagePolicy`** — `pure` or `warn`. Controls what happens when a third-party package method is identified by type but has no effect map entry. Set to `"pure"` to trust that most library methods are side-effect-free (recommended for most projects). If omitted, falls back to `unknownEffectPolicy`.
- **`packages`** — Per-package overrides. Use this to explicitly trust utility packages while keeping enforcement on IO-heavy ones:
  ```json
  {
    "packages": {
      "lodash": { "defaultPolicy": "pure" },
      "pg": { "defaultPolicy": "warn" }
    },
    "check": { "defaultPackagePolicy": "pure" }
  }
  ```
  Resolution priority: effect map entry (always wins) → per-package policy → `defaultPackagePolicy` → `unknownEffectPolicy`.
- **Scope.** If your `tsconfig.json` includes test fixtures or examples that aren't meant to pass `hewg check`, add a `tsconfig.hewg.json` that only covers your production `src/` and run `hewg check --project tsconfig.hewg.json`. This is what the Hewg repo does for its own self-check — see `hewg-ts/tsconfig.hewg.json`.

## 3. The annotation loop

Work in small slices; one commit per slice. After every slice, run `hewg check` and look at what changed.

1. **Annotate a pure leaf.** Pick a file whose exports obviously have no I/O — pure data transforms, type predicates, string munging. Add a JSDoc block with `@hewg-module <relative-path>` on the first exported declaration, and a bare `@effects` (empty) on every exported function in the file.
2. **Run `hewg check`.** If nothing changed, you annotated a correctly pure function. If you see W0003s, those are calls Hewg doesn't recognize. For each W0003, decide: is this callee pure? (Add it to `effectMap` with `effects: []`.) Or does it do something? (Add it with the right effect, or annotate the user function it resolves to.)
3. **Climb one layer.** Move up to a function that calls leaves you just annotated. Declare its effects honestly — the union of what it calls, plus whatever its own body does. If you're wrong, `hewg check` will tell you (E0301 if you missed an effect, E0302 if you over-declared one).
4. **Threading caps comes later.** Don't bother with `@cap` until your effects are clean. Once they are, pick the leaf function that actually opens a file or makes an HTTP call, and add `@cap param kind scope...`. Then walk the call graph upward, threading that parameter name through each layer.

## 4. Effect-row cookbook

| If your function… | Declare |
|---|---|
| Is pure (no I/O, no clock, no randomness, no log) | `@effects` |
| Reads a file (`fs.readFile`, `readFileSync`, `existsSync`, `stat`, `readdir`) | `@effects fs.read` |
| Writes a file (`writeFileSync`, `mkdirSync`, `rmSync`, `chmod`) | `@effects fs.write` |
| Makes an HTTP(S) request (`fetch`, `XMLHttpRequest`, `node:https.request`) | `@effects net.https` (or `net.http`) |
| Spawns a process (`child_process.spawn`, `exec`, `fork`) | `@effects proc.spawn` |
| Reads env or argv (`process.env.X`, `process.argv`, `process.cwd`) | `@effects proc.env` (or `fs.read` for `cwd`) |
| Logs (`console.log`, `console.error`) | `@effects log` |
| Sleeps or sets a timer (`setTimeout`, `setInterval`, `await sleep`) | `@effects time.sleep` |
| Reads the clock (`Date.now`, `performance.now`) | `@effects time.read` |
| Rolls a die (`Math.random`, `crypto.getRandomValues`) | `@effects rand` |

Effects stack with commas: `@effects fs.read, log, time.read`.

## 5. Capability threading — a worked example

Start with a leaf that writes to a specific output directory:

```ts
/**
 * @effects fs.write
 * @cap out fs.write prefix="./dist/"
 */
export function writeArtifact(out: FsWriteCap, path: string, body: string): void {
  writeFileSync(resolve(out.base, path), body)
}
```

A caller that invokes `writeArtifact` must thread a cap through a parameter with the **same name** (`out`) and at least as narrow a scope:

```ts
/**
 * @effects fs.write
 * @cap out fs.write prefix="./dist/"
 */
export function emitBundle(out: FsWriteCap, bundles: Bundle[]): void {
  for (const b of bundles) writeArtifact(out, b.path, b.code)
}
```

And so on up to the CLI entry point, which sits at the process boundary and actually constructs the capability. If any caller forgets to declare `@cap out ...`, `hewg check` reports **E0402**. If the name mismatches, **E0403**. If the scope widens (e.g. caller has `prefix="./"` but callee needs `prefix="./dist/"`), **E0401**.

The payoff: reading `writeArtifact`'s contract tells you exactly which directory it's allowed to touch, without reading the body.

## 6. When Hewg is wrong

Hewg's analyzer is a v0. Two gaps you will hit:

- **Method calls on typed locals** (`sf.getFilePath()`, `arr.map(...)`) currently don't resolve into the effect map — Hewg keys them by the receiver variable name, which isn't project-stable. You will see W0003 for these; that's expected. Don't try to silence them by adding `sf.getFilePath` entries to `effectMap`; that won't match the next file where the variable is named `sourceFile`.
- **Property reads** (`process.platform`, `Bun.version`) aren't detected as effects — effect propagation walks call expressions only. If you know a function reads env even though Hewg can't see it, declare the effect anyway. E0302 won't fire as long as there's at least one matching call elsewhere; and the honest declaration shows up in the contract for downstream readers (including LLMs).

When you genuinely find a bug — a callee you know the effect of, correctly keyed, but Hewg refuses to pick up — file it and move on. Don't contort your code to work around it.

## 7. Reading diagnostics

- **E0301** — `callee X performs effect Y, not declared in @effects Z`. You called something that does more than you said. Fix: add the effect, or add a matching `@cap`.
- **E0302** — `@effects declares X but no call in the body produces it (and no @cap covers it)`. You over-declared. Fix: drop the effect, or add the call that justifies it.
- **E0402** — `callee X requires @cap Y; add an @cap on this function`. A callee needs a capability you aren't threading. Fix: add `@cap` with the same parameter name.
- **E0403** — capability parameter name mismatch between caller and callee.
- **E0401** — capability scope too narrow at the callee vs. the caller's. Fix: tighten the caller, or loosen the callee's requirement.
- **W0003** — `callee X is not in the effect map; if it is pure, add an entry with effects: [] in hewg.config.json`. Informational, not an error. To suppress W0003 for an entire package, add it to `packages` with `{ "defaultPolicy": "pure" }`, or set `check.defaultPackagePolicy` to `"pure"`.
- **I0001** — `symbol has no Hewg annotations`. Appears on `hewg contract`. Your cue to annotate.

## 8. Checking your work

- **`hewg contract <symbol>`** — prints the structured contract for a single export. Confirms Hewg sees what you declared. `effects: []` means declared pure; `effects: null` means unknown (not yet annotated).
- **`hewg summary <module>`** — prints a compact per-module view: union of effects, list of exports with their declared rows, exported types. Good for the final read-through.
- **`hewg check`** — the full pass. Exit 0 is the goal; warnings are fine during active annotation.

Run all three after every few files. The feedback loop is short on purpose.

## 9. What we learned dogfooding Hewg on itself

- Pure is the most common effect row. A new project that looks like it "does a lot of things" will, on inspection, have most exports marked `@effects` (empty).
- Sitting at the process boundary means you rarely need `@cap`. The Hewg CLI itself has zero `@cap`s; effects stop at `runCheck` / `runInit` / `runContract`. Caps come into play in library code that wants to constrain its own callers.
- The effect map is a living artifact. Expect to add 20-50 entries to your `hewg.config.json` in the first week — mostly known-pure stdlib calls that Hewg doesn't ship with (`node:path.*` and `JSON.*` are in the built-in map as of Epic 8, but your runtime may pull in others).
- See `BUGS_FOUND.md` for the specific rough edges we hit during our own first pass. Your mileage may vary, but the shape of the churn will be similar.
