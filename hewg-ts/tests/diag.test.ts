import { describe, expect, test } from "bun:test";
import Ajv from "ajv-draft-04";
import addFormats from "ajv-formats";
import sarifSchema from "./fixtures/sarif-2.1.0-schema.json" with { type: "json" };
import { DIAGNOSTIC_REGISTRY, type DiagnosticCode } from "../src/diag/codes.ts";
import { DIAGNOSTIC_EXAMPLES, SYNTHETIC_SOURCES } from "../src/diag/examples.ts";
import { renderHuman, renderJson, renderSarif } from "../src/diag/render.ts";
import type { Diagnostic } from "../src/diag/types.ts";

const codes = Object.keys(DIAGNOSTIC_REGISTRY) as DiagnosticCode[];
const examples: Diagnostic[] = codes.map((c) => DIAGNOSTIC_EXAMPLES[c]);

describe("diagnostic catalog", () => {
  test("every registered code has an example", () => {
    for (const code of codes) {
      expect(DIAGNOSTIC_EXAMPLES[code]).toBeDefined();
      expect(DIAGNOSTIC_EXAMPLES[code].code).toBe(code);
    }
    expect(Object.keys(DIAGNOSTIC_EXAMPLES).sort()).toEqual([...codes].sort());
  });

  test("example severity and docs match the registry", () => {
    for (const code of codes) {
      const info = DIAGNOSTIC_REGISTRY[code];
      const ex = DIAGNOSTIC_EXAMPLES[code];
      expect(ex.severity).toBe(info.severity);
      expect(ex.docs).toBe(info.docsUrl);
    }
  });

  test("primary spans reference lines present in synthetic source (when supplied)", () => {
    for (const ex of examples) {
      const src = SYNTHETIC_SOURCES.get(ex.file);
      if (src === undefined) continue;
      const lines = src.split("\n");
      expect(
        lines[ex.line - 1],
        `${ex.code}: line ${ex.line} of ${ex.file} must exist`,
      ).toBeDefined();
      expect(ex.col).toBeGreaterThanOrEqual(1);
      expect(ex.len).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("json renderer", () => {
  test("produces one JSON object per line, no trailing newline", () => {
    const out = renderJson(examples);
    expect(out.endsWith("\n")).toBe(false);
    const lines = out.split("\n");
    expect(lines.length).toBe(examples.length);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  test("round-trips structurally", () => {
    const out = renderJson(examples);
    const parsed = out.split("\n").map((l) => JSON.parse(l));
    expect(parsed).toEqual(examples);
  });

  test("renderJson([]) is the empty string", () => {
    expect(renderJson([])).toBe("");
  });
});

describe("human renderer", () => {
  test("every example renders with file:line:col, message, and [code]", () => {
    for (const ex of examples) {
      const out = renderHuman([ex], { sources: SYNTHETIC_SOURCES });
      expect(out).toContain(`${ex.file}:${ex.line}:${ex.col}`);
      expect(out).toContain(ex.message);
      expect(out).toContain(`[${ex.code}]`);
    }
  });

  test("renders a carat block when source is supplied", () => {
    const e0301 = DIAGNOSTIC_EXAMPLES.E0301;
    const out = renderHuman([e0301], { sources: SYNTHETIC_SOURCES });
    expect(out).toContain("^".repeat(e0301.len));
    expect(out).toContain("-->");
  });

  test("degrades gracefully without sources", () => {
    const e0301 = DIAGNOSTIC_EXAMPLES.E0301;
    const out = renderHuman([e0301]);
    expect(out).toContain("-->");
    expect(out).toContain(e0301.message);
    expect(out).not.toContain("^".repeat(e0301.len));
  });

  test("emits no ANSI escape codes by default", () => {
    const out = renderHuman(examples, { sources: SYNTHETIC_SOURCES });
    expect(out).not.toMatch(/\x1b\[/);
  });
});

describe("sarif renderer", () => {
  const out = renderSarif(examples, { toolVersion: "0.0.1-test" });
  const log = JSON.parse(out);

  test("parses as JSON with a single run", () => {
    expect(log.version).toBe("2.1.0");
    expect(Array.isArray(log.runs)).toBe(true);
    expect(log.runs.length).toBe(1);
    expect(log.runs[0].results.length).toBe(examples.length);
    expect(log.runs[0].tool.driver.rules.length).toBe(codes.length);
  });

  test("severity maps to SARIF level correctly", () => {
    const byCode: Record<string, { level: string }> = {};
    for (const r of log.runs[0].results) byCode[r.ruleId] = r;
    expect(byCode.E0301?.level).toBe("error");
    expect(byCode.E0302?.level).toBe("warning");
    expect(byCode.W0001?.level).toBe("warning");
  });

  test("validates against the vendored SARIF 2.1.0 schema", () => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(sarifSchema);
    const ok = validate(log);
    if (!ok) {
      console.error(JSON.stringify(validate.errors, null, 2));
    }
    expect(ok).toBe(true);
  });
});

describe("renderer cleanliness", () => {
  test("every example renders non-empty in all three formats", () => {
    for (const ex of examples) {
      expect(renderJson([ex]).length).toBeGreaterThan(0);
      expect(renderHuman([ex], { sources: SYNTHETIC_SOURCES }).length).toBeGreaterThan(0);
      expect(renderSarif([ex]).length).toBeGreaterThan(0);
    }
  });
});
