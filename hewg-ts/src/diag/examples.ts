import type { Diagnostic } from "./types.ts";
import { DIAGNOSTIC_REGISTRY, type DiagnosticCode } from "./codes.ts";

const docs = (code: DiagnosticCode): string => DIAGNOSTIC_REGISTRY[code].docsUrl;

export const DIAGNOSTIC_EXAMPLES: Record<DiagnosticCode, Diagnostic> = {
  E0001: {
    code: "E0001",
    severity: "error",
    file: ".",
    line: 1,
    col: 1,
    len: 1,
    message: "no tsconfig.json found at or above the current directory",
    notes: [
      { message: "run `hewg check` from a directory containing a tsconfig.json, or pass --project <path>" },
    ],
    docs: docs("E0001"),
  },

  E0002: {
    code: "E0002",
    severity: "error",
    file: "src/payments/refund.ts",
    line: 1,
    col: 1,
    len: 1,
    message: "could not read file: EACCES",
    docs: docs("E0002"),
  },

  E0003: {
    code: "E0003",
    severity: "error",
    file: "-",
    line: 1,
    col: 1,
    len: 1,
    message: "symbol `payments/refund::refnud` not found",
    suggest: [
      {
        kind: "rename-arg",
        rationale: "did you mean `refund`?",
        at: { file: "-", line: 1, col: 1, len: 1 },
        insert: "payments/refund::refund",
      },
    ],
    docs: docs("E0003"),
  },

  E0004: {
    code: "E0004",
    severity: "error",
    file: "-",
    line: 1,
    col: 1,
    len: 1,
    message: "symbol `refund` is ambiguous (2 matches)",
    related: [
      {
        file: "src/payments/refund.ts",
        line: 11,
        col: 1,
        len: 6,
        message: "candidate: payments/refund::refund",
      },
      {
        file: "src/audit/refund.ts",
        line: 8,
        col: 1,
        len: 6,
        message: "candidate: audit/refund::refund",
      },
    ],
    docs: docs("E0004"),
  },

  E0005: {
    code: "E0005",
    severity: "error",
    file: "hewg.config.json",
    line: 1,
    col: 1,
    len: 1,
    message: "hewg.config.json already exists; refusing to overwrite",
    docs: docs("E0005"),
  },

  I0001: {
    code: "I0001",
    severity: "info",
    file: "src/payments/refund.ts",
    line: 11,
    col: 1,
    len: 6,
    message: "symbol `payments/refund::refund` has no Hewg annotations; returning signature only",
    notes: [
      { message: "run `hewg check` to see whether this function should declare @effects; null in the contract means 'unknown', not 'pure'" },
    ],
    docs: docs("I0001"),
  },

  E0201: {
    code: "E0201",
    severity: "error",
    file: "src/payments/refund.ts",
    line: 3,
    col: 4,
    len: 20,
    message: "malformed @effects tag: expected comma-separated effect names",
    suggest: [
      {
        kind: "fix-syntax",
        rationale: "separate effect names with commas",
        at: { file: "src/payments/refund.ts", line: 3, col: 14, len: 10 },
        insert: "net.https, fs.write",
      },
    ],
    docs: docs("E0201"),
  },

  E0202: {
    code: "E0202",
    severity: "error",
    file: "src/payments/refund.ts",
    line: 4,
    col: 9,
    len: 4,
    message: "@cap references parameter `htpp` which does not exist on this function",
    related: [
      {
        file: "src/payments/refund.ts",
        line: 11,
        col: 30,
        len: 4,
        message: "did you mean `http`?",
      },
    ],
    suggest: [
      {
        kind: "rename-arg",
        rationale: "rename the @cap parameter to match the function signature",
        at: { file: "src/payments/refund.ts", line: 4, col: 9, len: 4 },
        insert: "http",
      },
    ],
    docs: docs("E0202"),
  },

  E0301: {
    code: "E0301",
    severity: "error",
    file: "src/audit.ts",
    line: 6,
    col: 23,
    len: 11,
    message: "call to `fs.readFile` performs effect `fs.read`, not declared in @effects `log`",
    related: [
      {
        file: "src/audit.ts",
        line: 2,
        col: 13,
        len: 3,
        message: "effect row declared here",
      },
    ],
    suggest: [
      {
        kind: "add-effect",
        rationale: "declare the effect",
        at: { file: "src/audit.ts", line: 2, col: 16, len: 0 },
        insert: ", fs.read",
      },
      {
        kind: "add-cap",
        rationale: "thread an Fs.Read capability from the caller",
        at: { file: "src/audit.ts", line: 3, col: 1, len: 0 },
        insert: " * @cap fs fs.read prefix=\"./receipts/\"\n",
      },
    ],
    docs: docs("E0301"),
  },

  E0302: {
    code: "E0302",
    severity: "warning",
    file: "src/payments/refund.ts",
    line: 3,
    col: 26,
    len: 8,
    message: "@effects declares `fs.write` but no call in the body produces it (and no @cap covers it)",
    suggest: [
      {
        kind: "remove-effect",
        rationale: "drop the unused effect",
        at: { file: "src/payments/refund.ts", line: 3, col: 25, len: 9 },
        insert: "",
      },
    ],
    docs: docs("E0302"),
  },

  E0303: {
    code: "E0303",
    severity: "error",
    file: "src/payments/refund.ts",
    line: 3,
    col: 16,
    len: 17,
    message: "override widens effect row of parent declaration (adds `fs.write`)",
    related: [
      {
        file: "src/payments/refund.d.ts",
        line: 2,
        col: 13,
        len: 9,
        message: "parent effect row declared here",
      },
    ],
    suggest: [
      {
        kind: "widen-effects",
        rationale: "widen the parent declaration to match",
        at: { file: "src/payments/refund.d.ts", line: 2, col: 22, len: 0 },
        insert: ", fs.write",
      },
    ],
    docs: docs("E0303"),
  },

  E0401: {
    code: "E0401",
    severity: "error",
    file: "src/audit.ts",
    line: 9,
    col: 17,
    len: 6,
    message: "capability scope too narrow: callee requires host=\"api.stripe.com\", caller provides host=\"*\"",
    related: [
      {
        file: "src/payments/refund.ts",
        line: 4,
        col: 4,
        len: 40,
        message: "callee requires @cap here",
      },
    ],
    suggest: [
      {
        kind: "narrow-cap",
        rationale: "tighten the caller's capability scope to match the callee",
        at: { file: "src/audit.ts", line: 9, col: 17, len: 6 },
        insert: "stripeClient",
      },
    ],
    docs: docs("E0401"),
  },

  E0402: {
    code: "E0402",
    severity: "error",
    file: "src/audit.ts",
    line: 9,
    col: 10,
    len: 6,
    message: "callee `refund` requires @cap `http`; add an @cap on this function (or its nearest ancestor that owns the capability)",
    suggest: [
      {
        kind: "add-cap",
        rationale: "add an @cap annotation for the caller",
        at: { file: "src/audit.ts", line: 3, col: 1, len: 0 },
        insert: " * @cap http net.https host=\"api.stripe.com\"\n",
      },
    ],
    docs: docs("E0402"),
  },

  E0403: {
    code: "E0403",
    severity: "error",
    file: "src/audit.ts",
    line: 9,
    col: 17,
    len: 6,
    message: "capability argument `client` does not match parameter name `http` expected by callee",
    suggest: [
      {
        kind: "rename-arg",
        rationale: "rename the argument to match the capability parameter",
        at: { file: "src/audit.ts", line: 9, col: 17, len: 6 },
        insert: "http",
      },
    ],
    docs: docs("E0403"),
  },

  E0501: {
    code: "E0501",
    severity: "error",
    file: "src/payments/refund.ts",
    line: 7,
    col: 10,
    len: 18,
    message: "malformed @pre expression: unexpected token `>` at position 15",
    suggest: [
      {
        kind: "fix-syntax",
        rationale: "use `>=` for greater-or-equal",
        at: { file: "src/payments/refund.ts", line: 7, col: 24, len: 1 },
        insert: ">=",
      },
    ],
    docs: docs("E0501"),
  },

  W0001: {
    code: "W0001",
    severity: "warning",
    file: "src/payments/refund.ts",
    line: 9,
    col: 10,
    len: 6,
    message: "unknown @cost field `tokenz`; expected one of tokens, ops, net, time",
    suggest: [
      {
        kind: "fix-cost-field",
        rationale: "did you mean `tokens`?",
        at: { file: "src/payments/refund.ts", line: 9, col: 10, len: 6 },
        insert: "tokens",
      },
    ],
    docs: docs("W0001"),
  },

  W0002: {
    code: "W0002",
    severity: "warning",
    file: "src/payments/refund.ts",
    line: 2,
    col: 4,
    len: 11,
    message: "unknown tag `@hewg-magic`; will be ignored",
    suggest: [
      {
        kind: "remove-annotation",
        rationale: "remove the unknown tag",
        at: { file: "src/payments/refund.ts", line: 2, col: 1, len: 21 },
        insert: "",
      },
    ],
    docs: docs("W0002"),
  },

  W0003: {
    code: "W0003",
    severity: "warning",
    file: "src/unknown.ts",
    line: 5,
    col: 3,
    len: 13,
    message: "callee `externalThing` is not in the effect map; if it is pure, add an entry with effects: [] in hewg.config.json",
    notes: [
      { message: "add an effect-map entry in hewg.config.json, or annotate the callee" },
    ],
    docs: docs("W0003"),
  },

  E0601: {
    code: "E0601",
    severity: "error",
    file: ".hewg-baseline.json",
    line: 1,
    col: 1,
    len: 1,
    message: "baseline file is corrupt: unexpected token at position 0",
    notes: [
      { message: "delete .hewg-baseline.json and run `hewg baseline update` to regenerate" },
    ],
    docs: docs("E0601"),
  },

  I0002: {
    code: "I0002",
    severity: "info",
    file: ".hewg-baseline.json",
    line: 1,
    col: 1,
    len: 1,
    message: "baseline strict mode: new violation count (8) exceeds existing baseline (5)",
    notes: [
      { message: "fix violations before updating the baseline, or disable strict mode in hewg.config.json" },
    ],
    docs: docs("I0002"),
  },
};

export const SYNTHETIC_SOURCES: Map<string, string> = new Map([
  [
    "src/audit.ts",
    [
      "/**",
      " * @effects log",
      " * @cap log log",
      " */",
      "export async function audit(path: string) {",
      "   const data = await fs.readFile(path); return data;",
      "}",
      "export async function caller() {",
      "   await refund(client, 10);",
      "}",
    ].join("\n"),
  ],
  [
    "src/payments/refund.ts",
    [
      "/**",
      " * @hewg-magic unused",
      " * @effects    net.https fs.write",
      " * @cap htpp net.https host=\"api.stripe.com\"",
      " * @cap fs   fs.write  prefix=\"./receipts/\"",
      " * @cap log  log",
      " * @pre  amountCents > 0 && tokens > zero",
      " * @post result.ok => exists",
      " * @cost tokenz=120 ops=~6",
      " */",
      "export async function refund(http: HttpClient, amountCents: number) {",
      "  return {} as unknown;",
      "}",
    ].join("\n"),
  ],
  [
    "src/unknown.ts",
    [
      "/**",
      " * @effects log",
      " */",
      "export function foo() {",
      "  externalThing();",
      "}",
    ].join("\n"),
  ],
  [
    "src/payments/refund.d.ts",
    [
      "/**",
      " * @effects net.https",
      " */",
      "export declare function refund(",
      "  http: HttpClient,",
      "  amountCents: number,",
      "): Promise<unknown>;",
      "",
      "/**",
      " * @effects net.https",
      " */",
      "export declare class RefundService {",
      "  refund(http: HttpClient, amountCents: number): Promise<unknown>;",
      "}",
    ].join("\n"),
  ],
]);
