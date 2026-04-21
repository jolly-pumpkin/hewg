# Task Selection Rationale

Explains why each of the 10 benchmark tasks was chosen and which Hewg mechanism it exercises.

---

## 1. add-retry-no-new-effects

**Category:** Effect discovery (30% weight)
**Mechanism:** `@effects net.https` constrains the agent to add retry logic using only declared effects.
**Expected differentiation:** In condition 1 (plain TS), the agent has no signal about acceptable side effects and may introduce `console.log`, `setTimeout`, or file writes. In conditions 3-4, the `@effects` annotation explicitly constrains the implementation.
**Why this scenario:** Retry logic is the canonical "easy to add, easy to leak effects" task. The temptation to add logging or delay is strong and realistic.

## 2. make-idempotent

**Category:** Effect discovery (30% weight)
**Mechanism:** `@effects fs.read, fs.write, net.https` — the agent can use `fs.read` for idempotency checks but must not add new effect kinds.
**Expected differentiation:** Idempotency requires adding a guard (read before write). Without effect annotations, agents may add logging, caching, or other side effects as part of the idempotency mechanism.
**Why this scenario:** Idempotency is a frequent real-world refactoring request that inherently involves reasoning about which IO is acceptable.

## 3. extract-pure-transform

**Category:** Effect discovery (30% weight)
**Mechanism:** The original function has `@effects fs.read, fs.write`; the extracted function should be pure (no effects). The annotation makes the "pure subset" explicit.
**Expected differentiation:** In annotated conditions, the agent can see which parts of the function are pure vs effectful, guiding the extraction boundary. In plain TS, the agent must infer this from the code alone.
**Why this scenario:** Extract-pure-from-impure is a foundational functional-programming refactoring that directly tests whether effect annotations help identify purity boundaries.

## 4. inject-http-client

**Category:** Capability threading (20% weight)
**Mechanism:** `@cap http net.https host="api.prices.example.com"` — the agent must introduce a capability parameter and thread it through the function.
**Expected differentiation:** The `@cap` annotation tells the agent exactly what kind of parameter to introduce and what constraints it has. Without it, the agent must guess the right abstraction level.
**Why this scenario:** Dependency injection of HTTP clients is the most common capability-threading pattern in production TS codebases.

## 5. split-pure-io

**Category:** Capability threading (20% weight)
**Mechanism:** `@effects` (empty) on `buildManifest` and `@cap out fs.write` on the IO shell show the intended boundary.
**Expected differentiation:** The annotations explicitly mark which logic is pure and which capabilities the IO shell needs. This guides the split without the agent needing to trace all data flow.
**Why this scenario:** "Functional core, imperative shell" is a well-known pattern. This task tests whether capability annotations make the boundary obvious enough to accelerate the refactoring.

## 6. add-error-variant

**Category:** Cross-file edit (25% weight)
**Mechanism:** Effect propagation — adding a `RateLimited` error variant may introduce new code paths that need to respect `@effects` declarations at each call site.
**Expected differentiation:** In conditions 3-4, `hewg check` can flag call sites where the new variant's handling introduces undeclared effects. In conditions 1-2, the agent must manually trace all call sites.
**Why this scenario:** Adding an error variant and handling it everywhere is one of the most common cross-file editing tasks and a frequent source of missed call sites.

## 7. rename-and-update-callers

**Category:** Cross-file edit (25% weight)
**Mechanism:** `hewg contract` (condition 4) can reveal all callers of a symbol; `@hewg-module` paths serve as a navigational map.
**Expected differentiation:** Condition 4's `hewg_contract` tool lets the agent discover all dependents without manually reading every file. This tests whether the tool access (not just annotations) provides value.
**Why this scenario:** Renaming across files is a mechanical but error-prone task where missing a call site breaks compilation. It directly tests whether the contract tool reduces missed sites.

## 8. propagate-async

**Category:** Cross-file edit (25% weight)
**Mechanism:** `@effects fs.read` stays the same, but the signature change must propagate through all callers. `hewg contract` shows the dependency chain.
**Expected differentiation:** The contract tool helps map the propagation path. The effect annotations confirm that the function's behavior (fs.read) doesn't change — only the async wrapper does.
**Why this scenario:** Sync-to-async conversion with propagation is a real and painful refactoring that scales with call depth. It tests whether the contract tool accelerates multi-hop changes.

## 9. optimize-preserving-post

**Category:** Contract-respecting (10% weight)
**Mechanism:** `@pre` and `@post` annotations declare the behavioral contract. The agent must optimize the implementation while preserving these guarantees.
**Expected differentiation:** In annotated conditions, the postconditions are explicit machine-readable text. In plain TS, the agent must infer the contract from the function name, tests, or usage patterns.
**Why this scenario:** "Optimize but don't break the contract" is a high-risk refactoring where explicit contracts reduce regression risk. This is the only task that tests `@pre`/`@post`.

## 10. refactor-algorithm

**Category:** Null hypothesis (15% weight)
**Mechanism:** None. The function is pure (`@effects` empty). Annotations provide no structural advantage for a purely algorithmic refactoring.
**Expected differentiation:** Performance should be roughly equal across all conditions. If annotated conditions score higher, it suggests a confound in the benchmark (e.g., JSDoc providing general context advantage).
**Why this scenario:** Every good experiment needs a control. A pure algorithmic task where annotations are irrelevant validates that the benchmark isn't accidentally biasing toward annotated conditions.
