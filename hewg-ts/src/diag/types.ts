import type { DiagnosticCode } from "./codes.ts";

/**
 * @hewg-module diag/types
 */
export type Severity = "error" | "warning" | "info" | "help";

export type Span = {
  file: string;
  line: number;
  col: number;
  len: number;
};

export type RelatedInfo = Span & { message: string };

export type SuggestionKind =
  | "add-effect"
  | "remove-effect"
  | "widen-effects"
  | "add-cap"
  | "narrow-cap"
  | "rename-arg"
  | "add-annotation"
  | "remove-annotation"
  | "fix-syntax"
  | "add-pre"
  | "add-post"
  | "fix-cost-field";

export type Suggestion = {
  kind: SuggestionKind;
  rationale: string;
  at: Span;
  insert: string;
};

export type Note = { message: string; span?: Span };

export type Diagnostic = {
  code: DiagnosticCode;
  severity: Severity;
  file: string;
  line: number;
  col: number;
  len: number;
  message: string;
  related?: RelatedInfo[];
  suggest?: Suggestion[];
  notes?: Note[];
  docs: string;
};
