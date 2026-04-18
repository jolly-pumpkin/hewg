import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { BUILTIN_EFFECT_MAP_DATA } from "../src/analysis/effect-map.ts"

const here = dirname(fileURLToPath(import.meta.url))
const outPath = join(here, "..", "..", "docs", "EffectMap.md")

type Row = { key: string; effects: readonly string[]; note?: string }

const entries = BUILTIN_EFFECT_MAP_DATA.entries
const all: Row[] = Object.entries(entries).map(([key, entry]) => ({
  key,
  effects: entry.effects,
  note: entry.note,
}))

function group(predicate: (r: Row) => boolean): Row[] {
  return all.filter(predicate).sort((a, b) => a.key.localeCompare(b.key))
}

const webGlobals = group(
  (r) =>
    !r.key.startsWith("node:") &&
    (r.key === "fetch" ||
      r.key === "XMLHttpRequest" ||
      r.key === "WebSocket" ||
      r.key.startsWith("Date.") ||
      r.key.startsWith("Math.") ||
      r.key.startsWith("performance.") ||
      r.key.startsWith("console.") ||
      r.key.startsWith("localStorage.") ||
      r.key.startsWith("sessionStorage.") ||
      r.key.startsWith("crypto.")),
)
const nodeFs = group((r) => r.key.startsWith("node:fs.") || r.key.startsWith("node:fs/promises."))
const nodeHttp = group((r) => r.key.startsWith("node:http.") || r.key.startsWith("node:https."))
const nodeChild = group((r) => r.key.startsWith("node:child_process."))
const nodeProcess = group(
  (r) => r.key.startsWith("node:process.") || r.key.startsWith("process."),
)
const nodeOs = group((r) => r.key.startsWith("node:os."))
const nodeCrypto = group((r) => r.key.startsWith("node:crypto."))

const npmPackages: readonly string[] = [
  "axios",
  "node-fetch",
  "got",
  "ky",
  "pg",
  "mysql2",
  "redis",
  "ioredis",
  "mongoose",
  "prisma",
  "nodemailer",
  "express",
  "winston",
  "pino",
  "dotenv",
  "node-cron",
  "ws",
  "socket.io",
  "bull",
  "jsonwebtoken",
]

function forPackage(pkg: string): Row[] {
  return group((r) => r.key === pkg || r.key.startsWith(`${pkg}.`))
}

function renderTable(rows: readonly Row[]): string {
  if (rows.length === 0) return "_(no entries)_\n"
  const lines: string[] = []
  lines.push("| Symbol | Effects | Rationale |")
  lines.push("|---|---|---|")
  for (const row of rows) {
    const effects = row.effects.length === 0 ? "_(pure)_" : row.effects.map((e) => `\`${e}\``).join(", ")
    const note = row.note ?? ""
    lines.push(`| \`${row.key}\` | ${effects} | ${note} |`)
  }
  return lines.join("\n") + "\n"
}

const lines: string[] = []
lines.push("# Effect Map")
lines.push("")
lines.push(
  "Hewg ships a curated map from standard-library and common-package symbols",
  "to the effects they produce. The analyzer consults this map when it walks a",
  "call graph and encounters an unannotated callee from the outside world. Users",
  "extend the map via `hewg.config.json` (see Design.md §6); user entries",
  "**override** — not append to — the built-in entry for the same key.",
)
lines.push("")
lines.push(
  "Every entry in this document has a test in `hewg-ts/tests/effect-map.test.ts`.",
  "Queries for symbols not in the map return `undefined`; entries with an empty",
  "effects list mean _known-pure_ — the analyzer treats them as effect-free",
  "without warning.",
)
lines.push("")

lines.push("## Key naming convention")
lines.push("")
lines.push("| Origin | Key form | Example |")
lines.push("|---|---|---|")
lines.push("| Global, no import | `<name>` or `<Object>.<member>` | `fetch`, `Math.random`, `console.log` |")
lines.push("| Node built-in module | `node:<module>.<member>` | `node:fs.readFile` |")
lines.push("| Node built-in, class method | `node:<module>.<Class>.<method>` | `node:http.Server.listen` |")
lines.push("| npm package, top-level | `<pkg>.<member>` or bare `<pkg>` | `axios.get`, `node-fetch` |")
lines.push("| npm package, class method | `<pkg>.<Class>.<method>` | `pg.Client.query` |")
lines.push("")

lines.push("## Effect vocabulary")
lines.push("")
lines.push(
  "Entries reference only the built-in effect names declared in",
  "`hewg-ts/src/annotations/effect-vocab.ts`:",
  "`net.http`, `net.https`, `net.tcp`, `net.udp`, `fs.read`, `fs.write`,",
  "`fs.exec`, `proc.spawn`, `proc.env`, `proc.exit`, `time.read`, `time.sleep`,",
  "`rand`, `log`.",
)
lines.push("")

lines.push("## Web standard / globals")
lines.push("")
lines.push(renderTable(webGlobals))

lines.push("## Node built-ins")
lines.push("")
lines.push("### `node:fs` and `node:fs/promises`")
lines.push("")
lines.push(renderTable(nodeFs))
lines.push("### `node:http` and `node:https`")
lines.push("")
lines.push(renderTable(nodeHttp))
lines.push("### `node:child_process`")
lines.push("")
lines.push(renderTable(nodeChild))
lines.push("### `node:process`")
lines.push("")
lines.push(renderTable(nodeProcess))
lines.push("### `node:os`")
lines.push("")
lines.push(renderTable(nodeOs))
lines.push("### `node:crypto`")
lines.push("")
lines.push(renderTable(nodeCrypto))

lines.push("## npm packages")
lines.push("")
lines.push(
  "Coverage is limited to the twenty packages enumerated in the roadmap's",
  "Epic 4. The selection is download-count-weighted and biased toward packages",
  "with unambiguous I/O effects. Additions beyond this set are explicitly a",
  "non-goal in v0; the benchmark is expected to reveal which additions matter.",
)
lines.push("")

for (const pkg of npmPackages) {
  lines.push(`### \`${pkg}\``)
  lines.push("")
  lines.push(renderTable(forPackage(pkg)))
}

lines.push("## Extending the map")
lines.push("")
lines.push("```json")
lines.push("{")
lines.push('  "effectMap": {')
lines.push('    "my-internal-logger.log": { "effects": ["log"] },')
lines.push('    "./src/db/client.query": { "effects": ["net.tcp", "log"] },')
lines.push('    "fetch": { "effects": ["net.http"] }')
lines.push("  }")
lines.push("}")
lines.push("```")
lines.push("")
lines.push(
  "User entries are merged at load time; a user key with the same name as a",
  "built-in key replaces the built-in. This is deliberate: if an in-house",
  "wrapper around `fetch` should be treated as `net.http` only, the user can",
  "say so without touching source.",
)
lines.push("")

lines.push("---")
lines.push("")
lines.push(
  "Generated from `hewg-ts/stdlib/effect-map.json`. Run `bun run gen:effect-map-doc`",
  "from `hewg-ts/` to regenerate.",
)
lines.push("")

writeFileSync(outPath, lines.join("\n"))
console.log(`wrote ${outPath}`)
