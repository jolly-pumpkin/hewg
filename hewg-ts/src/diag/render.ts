import pkg from "../../package.json" with { type: "json" };
import { DIAGNOSTIC_REGISTRY } from "./codes.ts";
import type { Diagnostic, RelatedInfo, Severity, Span, Suggestion } from "./types.ts";

export type RenderHumanOptions = {
  sources?: Map<string, string>;
  color?: boolean;
};

export type RenderSarifOptions = {
  toolVersion?: string;
};

/**
 * @hewg-module diag/render
 * @effects
 */
export function renderJson(diags: readonly Diagnostic[]): string {
  return diags.map((d) => JSON.stringify(d)).join("\n");
}

/**
 * @effects
 */
export function renderHuman(
  diags: readonly Diagnostic[],
  opts: RenderHumanOptions = {},
): string {
  const sources = opts.sources ?? new Map<string, string>();
  const blocks = diags.map((d) => renderHumanOne(d, sources));
  return blocks.join("\n\n");
}

function renderHumanOne(d: Diagnostic, sources: Map<string, string>): string {
  const out: string[] = [];
  out.push(`${d.severity}[${d.code}]: ${d.message}`);
  out.push(`  --> ${d.file}:${d.line}:${d.col}`);

  const source = sources.get(d.file);
  const gutterWidth = String(d.line).length;
  const pad = " ".repeat(gutterWidth);

  if (source !== undefined) {
    const line = getLine(source, d.line);
    if (line !== undefined) {
      out.push(`${pad} |`);
      out.push(`${String(d.line).padStart(gutterWidth)} | ${line}`);
      out.push(`${pad} | ${" ".repeat(Math.max(0, d.col - 1))}${carat(d.len)}`);
      out.push(`${pad} |`);
    }
  }

  if (d.related && d.related.length > 0) {
    for (const r of d.related) {
      out.push(renderRelated(r, sources));
    }
  }

  if (d.notes && d.notes.length > 0) {
    for (const n of d.notes) {
      out.push(`  = note: ${n.message}`);
    }
  }

  if (d.suggest && d.suggest.length > 0) {
    for (const s of d.suggest) {
      out.push(renderSuggestion(s, sources));
    }
  }

  out.push(`  = help: ${d.docs}`);
  return out.join("\n");
}

function renderRelated(r: RelatedInfo, sources: Map<string, string>): string {
  const out: string[] = [];
  out.push(`note: ${r.message}`);
  out.push(`  --> ${r.file}:${r.line}:${r.col}`);
  const source = sources.get(r.file);
  if (source !== undefined) {
    const line = getLine(source, r.line);
    if (line !== undefined) {
      const gutterWidth = String(r.line).length;
      const pad = " ".repeat(gutterWidth);
      out.push(`${pad} |`);
      out.push(`${String(r.line).padStart(gutterWidth)} | ${line}`);
      out.push(`${pad} | ${" ".repeat(Math.max(0, r.col - 1))}${carat(r.len)}`);
    }
  }
  return out.join("\n");
}

function renderSuggestion(s: Suggestion, sources: Map<string, string>): string {
  const out: string[] = [];
  out.push(`help: ${s.rationale}`);
  const gutterWidth = String(s.at.line).length;
  const pad = " ".repeat(gutterWidth);
  const source = sources.get(s.at.file);
  if (source !== undefined) {
    const line = getLine(source, s.at.line);
    if (line !== undefined) {
      out.push(`${pad} |`);
      const marker = s.at.len === 0 ? "+" : "~";
      out.push(`${String(s.at.line).padStart(gutterWidth)} | ${line}`);
      out.push(
        `${pad} | ${" ".repeat(Math.max(0, s.at.col - 1))}${marker} ${s.insert.replace(/\n/g, "\u23CE")}`,
      );
    }
  } else {
    out.push(`${pad} | + ${s.insert.replace(/\n/g, "\u23CE")}`);
  }
  return out.join("\n");
}

function carat(len: number): string {
  if (len <= 0) return "^";
  return "^".repeat(len);
}

function getLine(source: string, line: number): string | undefined {
  const lines = source.split("\n");
  return lines[line - 1];
}

/**
 * @effects
 */
export function renderSarif(
  diags: readonly Diagnostic[],
  opts: RenderSarifOptions = {},
): string {
  const version = opts.toolVersion ?? pkg.version;
  const rules = Object.values(DIAGNOSTIC_REGISTRY).map((info) => ({
    id: info.code,
    name: info.category,
    shortDescription: { text: info.summary },
    helpUri: info.docsUrl,
    defaultConfiguration: { level: severityToLevel(info.severity) },
  }));

  const results = diags.map((d) => {
    const result: Record<string, unknown> = {
      ruleId: d.code,
      level: severityToLevel(d.severity),
      message: { text: d.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: d.file },
            region: regionFor(d),
          },
        },
      ],
    };
    if (d.related && d.related.length > 0) {
      result.relatedLocations = d.related.map((r, i) => ({
        id: i,
        physicalLocation: {
          artifactLocation: { uri: r.file },
          region: regionFor(r),
        },
        message: { text: r.message },
      }));
    }
    if (d.suggest && d.suggest.length > 0) {
      result.fixes = d.suggest.map((s) => ({
        description: { text: s.rationale },
        artifactChanges: [
          {
            artifactLocation: { uri: s.at.file },
            replacements: [
              {
                deletedRegion: regionFor(s.at),
                insertedContent: { text: s.insert },
              },
            ],
          },
        ],
      }));
    }
    return result;
  });

  const log = {
    $schema: "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "hewg",
            version,
            informationUri: "https://hewg.dev",
            rules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(log, null, 2);
}

function severityToLevel(sev: Severity): "error" | "warning" | "note" {
  switch (sev) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "note";
    case "help":
      return "note";
  }
}

function regionFor(s: Span): {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
} {
  return {
    startLine: s.line,
    startColumn: s.col,
    endLine: s.line,
    endColumn: s.col + s.len,
  };
}
