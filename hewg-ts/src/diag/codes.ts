import type { Severity } from "./types.ts";

export const DOCS_BASE = "https://hewg.dev/e/";

export type DiagnosticCategory =
  | "ingest"
  | "lookup"
  | "annotation-syntax"
  | "effect"
  | "capability"
  | "contract"
  | "baseline"
  | "warning";

export type DiagnosticInfo = {
  code: string;
  severity: Severity;
  category: DiagnosticCategory;
  summary: string;
  docsUrl: string;
};

function docs(code: string): string {
  return `${DOCS_BASE}${code}`;
}

/**
 * @hewg-module diag/codes
 */
export const DIAGNOSTIC_REGISTRY = {
  E0001: {
    code: "E0001",
    severity: "error",
    category: "ingest",
    summary: "tsconfig not found",
    docsUrl: docs("E0001"),
  },
  E0002: {
    code: "E0002",
    severity: "error",
    category: "ingest",
    summary: "file read error",
    docsUrl: docs("E0002"),
  },
  E0003: {
    code: "E0003",
    severity: "error",
    category: "lookup",
    summary: "symbol not found",
    docsUrl: docs("E0003"),
  },
  E0004: {
    code: "E0004",
    severity: "error",
    category: "lookup",
    summary: "ambiguous symbol reference",
    docsUrl: docs("E0004"),
  },
  E0005: {
    code: "E0005",
    severity: "error",
    category: "ingest",
    summary: "hewg.config.json already exists",
    docsUrl: docs("E0005"),
  },
  I0001: {
    code: "I0001",
    severity: "info",
    category: "contract",
    summary: "symbol has no Hewg annotations",
    docsUrl: docs("I0001"),
  },
  E0201: {
    code: "E0201",
    severity: "error",
    category: "annotation-syntax",
    summary: "malformed annotation tag",
    docsUrl: docs("E0201"),
  },
  E0202: {
    code: "E0202",
    severity: "error",
    category: "annotation-syntax",
    summary: "@cap references non-existent parameter",
    docsUrl: docs("E0202"),
  },
  E0301: {
    code: "E0301",
    severity: "error",
    category: "effect",
    summary: "effect not declared in @effects",
    docsUrl: docs("E0301"),
  },
  E0302: {
    code: "E0302",
    severity: "warning",
    category: "effect",
    summary: "declared effect never used",
    docsUrl: docs("E0302"),
  },
  E0303: {
    code: "E0303",
    severity: "error",
    category: "effect",
    summary: "effect row widening in override",
    docsUrl: docs("E0303"),
  },
  E0401: {
    code: "E0401",
    severity: "error",
    category: "capability",
    summary: "capability scope mismatch",
    docsUrl: docs("E0401"),
  },
  E0402: {
    code: "E0402",
    severity: "error",
    category: "capability",
    summary: "missing capability at call site",
    docsUrl: docs("E0402"),
  },
  E0403: {
    code: "E0403",
    severity: "error",
    category: "capability",
    summary: "capability passed as wrong parameter name",
    docsUrl: docs("E0403"),
  },
  E0501: {
    code: "E0501",
    severity: "error",
    category: "contract",
    summary: "malformed @pre/@post/@cost expression",
    docsUrl: docs("E0501"),
  },
  W0001: {
    code: "W0001",
    severity: "warning",
    category: "warning",
    summary: "unknown @cost field",
    docsUrl: docs("W0001"),
  },
  W0002: {
    code: "W0002",
    severity: "warning",
    category: "warning",
    summary: "unknown @hewg-* tag",
    docsUrl: docs("W0002"),
  },
  W0003: {
    code: "W0003",
    severity: "warning",
    category: "effect",
    summary: "effect of callee unknown; treated as pure",
    docsUrl: docs("W0003"),
  },
  E0601: {
    code: "E0601",
    severity: "error",
    category: "baseline",
    summary: "baseline file corrupt or unreadable",
    docsUrl: docs("E0601"),
  },
  I0002: {
    code: "I0002",
    severity: "info",
    category: "baseline",
    summary: "baseline strict mode: new violations exceed baseline count",
    docsUrl: docs("I0002"),
  },
} as const satisfies Record<string, DiagnosticInfo>;

export type DiagnosticCode = keyof typeof DIAGNOSTIC_REGISTRY;

/**
 * @effects
 */
export function severityFromCode(code: string): Severity {
  switch (code[0]) {
    case "E":
      return "error";
    case "W":
      return "warning";
    case "I":
      return "info";
    case "H":
      return "help";
    default:
      throw new Error(`unknown code prefix: ${code}`);
  }
}
