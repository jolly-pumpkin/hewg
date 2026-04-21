# Extract the pure transformation from `formatReport`

The workspace contains a small TypeScript project with `src/report.ts` that
exports a `formatReport` function. This function reads config from disk,
transforms report data into HTML, and writes the HTML to disk — mixing IO and
pure logic.

Your task: **Extract the pure transformation into a separate exported function**
called `renderHtml` that takes the config and data as parameters and returns the
HTML string.

Requirements:
1. Create and export a `renderHtml` function in `src/report.ts` with signature:
   `renderHtml(config: ReportConfig, data: ReportData): string`
2. `renderHtml` must be pure — it must NOT import or use `fs`, `readFileSync`,
   `writeFileSync`, or any IO operations.
3. Refactor `formatReport` to call `renderHtml` internally (so it still works).
4. The code must compile without type errors.

Run `run_tests` to verify. Exit code 0 means the task is complete; reply with
`DONE` once tests pass.
