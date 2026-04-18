import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DIAGNOSTIC_REGISTRY, type DiagnosticCode } from "../src/diag/codes.ts";
import { DIAGNOSTIC_EXAMPLES, SYNTHETIC_SOURCES } from "../src/diag/examples.ts";
import { renderHuman, renderJson, renderSarif } from "../src/diag/render.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "..", "docs", "Diagnostics.md");

const codes = Object.keys(DIAGNOSTIC_REGISTRY).sort() as DiagnosticCode[];

const lines: string[] = [];
lines.push("# Diagnostics");
lines.push("");
lines.push(
  "Every diagnostic emitted by `hewg` has a stable code. Codes are grouped by",
  "topic (ingest, annotation syntax, effects, capabilities, contracts,",
  "warnings), but topic and severity are independent — a code in the `E0301–`",
  "range may still carry `warning` severity.",
);
lines.push("");
lines.push("## Severity legend");
lines.push("");
lines.push("| Severity | Meaning |");
lines.push("|---|---|");
lines.push("| `error` | build-breaking; `hewg check` exits 1 |");
lines.push("| `warning` | advisory; does not affect exit code |");
lines.push("| `info` | observational |");
lines.push("| `help` | fix-it hint attached to another diagnostic |");
lines.push("");
lines.push("## Catalog");
lines.push("");
lines.push("| Code | Severity | Category | Summary |");
lines.push("|---|---|---|---|");
for (const code of codes) {
  const info = DIAGNOSTIC_REGISTRY[code];
  lines.push(`| [\`${info.code}\`](#${code.toLowerCase()}) | ${info.severity} | ${info.category} | ${info.summary} |`);
}
lines.push("");

for (const code of codes) {
  const info = DIAGNOSTIC_REGISTRY[code];
  const ex = DIAGNOSTIC_EXAMPLES[code];

  lines.push(`## ${code} — ${info.summary}`);
  lines.push("");
  lines.push(`- Severity: \`${info.severity}\``);
  lines.push(`- Category: \`${info.category}\``);
  lines.push(`- Docs: ${info.docsUrl}`);
  lines.push("");
  lines.push("### Human");
  lines.push("");
  lines.push("```");
  lines.push(renderHuman([ex], { sources: SYNTHETIC_SOURCES }));
  lines.push("```");
  lines.push("");
  lines.push("### JSON");
  lines.push("");
  lines.push("```json");
  lines.push(renderJson([ex]));
  lines.push("```");
  lines.push("");
  lines.push("### SARIF (excerpt)");
  lines.push("");
  lines.push("```json");
  const sarifLog = JSON.parse(renderSarif([ex]));
  lines.push(JSON.stringify(sarifLog.runs[0].results[0], null, 2));
  lines.push("```");
  lines.push("");
}

lines.push("---");
lines.push("");
lines.push(
  "Generated from `hewg-ts/src/diag/codes.ts` and `hewg-ts/src/diag/examples.ts`.",
  "Run `bun run gen:docs` from `hewg-ts/` to regenerate.",
);
lines.push("");

writeFileSync(outPath, lines.join("\n"));
console.log(`wrote ${outPath}`);
