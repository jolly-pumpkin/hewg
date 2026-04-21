# Split `deployArtifact` into pure core + IO shell

The workspace contains a small TypeScript project with `src/deploy.ts` that
exports a `deployArtifact` function. This function validates input, computes a
manifest (pure logic), then writes files to disk (IO) — all in one monolithic
function.

Your task: **Extract the pure manifest-building logic** into a separate exported
function called `buildManifest`.

Requirements:
1. Create and export a `buildManifest` function in `src/deploy.ts` with the
   signature: `buildManifest(input: ArtifactInput): Manifest`
2. `buildManifest` must be pure — it must NOT import or use `fs`,
   `writeFileSync`, `mkdirSync`, or any IO. It should handle validation and
   manifest computation only.
3. Refactor `deployArtifact` to call `buildManifest` internally, then handle
   only the IO (writing files).
4. The code must compile without type errors.

Run `run_tests` to verify. Exit code 0 means the task is complete; reply with
`DONE` once tests pass.
