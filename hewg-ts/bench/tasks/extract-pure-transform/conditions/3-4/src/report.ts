/**
 * @hewg-module report/report
 */

import { readFileSync, writeFileSync } from "node:fs"
import type { ReportConfig, ReportData, ReportRow } from "./types.ts"

/**
 * Generate an HTML report: reads config from disk, transforms data, writes HTML.
 * @param configPath - path to report config JSON
 * @param data - the report data rows
 * @param outputPath - path to write the HTML output
 * @effects fs.read, fs.write
 */
export function formatReport(
  configPath: string,
  data: ReportData,
  outputPath: string,
): void {
  const config: ReportConfig = JSON.parse(readFileSync(configPath, "utf8"))

  const headerCells = config.columns.map((col) => `<th>${col}</th>`).join("")
  const header = `<tr>${headerCells}</tr>`

  const bodyRows = data.rows.map((row) => {
    const cells = row.values.map((v) => `<td>${v}</td>`).join("")
    return `<tr><td>${row.label}</td>${cells}</tr>`
  })

  let totalsRow = ""
  if (config.showTotals) {
    const totals = config.columns.map((_, i) =>
      data.rows.reduce((sum, row) => sum + (row.values[i] ?? 0), 0),
    )
    const totalCells = totals.map((t) => `<td><strong>${t}</strong></td>`).join("")
    totalsRow = `<tr><td><strong>Total</strong></td>${totalCells}</tr>`
  }

  const html = `<!DOCTYPE html>
<html>
<head><title>${config.title}</title></head>
<body>
<h1>${config.title}</h1>
<p>Generated: ${data.generatedAt}</p>
<table>
<thead>${header}</thead>
<tbody>
${bodyRows.join("\n")}
${totalsRow}
</tbody>
</table>
</body>
</html>`

  writeFileSync(outputPath, html)
}
