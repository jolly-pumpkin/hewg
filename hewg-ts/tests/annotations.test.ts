import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { Project } from "ts-morph"
import { parseAnnotations } from "../src/annotations/parser.ts"
import {
  BUILTIN_EFFECTS,
  effectKindOf,
  isEffectName,
} from "../src/annotations/effect-vocab.ts"
import type { ParseResult } from "../src/annotations/types.ts"

const FIX_DIR = new URL("./fixtures/annotations/", import.meta.url).pathname
const PROJECT = new Project({
  compilerOptions: { noEmit: true },
  skipFileDependencyResolution: true,
  skipAddingFilesFromTsConfig: true,
  useInMemoryFileSystem: false,
})

function parse(name: string, symbol = "target", extraParamNames?: readonly string[]): ParseResult {
  const path = join(FIX_DIR, name)
  const sf = PROJECT.getSourceFile(path) ?? PROJECT.addSourceFileAtPath(path)
  const fn = sf.getFunctionOrThrow(symbol)
  const paramNames = extraParamNames ?? fn.getParameters().map((p) => p.getName())
  return parseAnnotations(fn, { paramNames })
}

function codes(res: ParseResult): string[] {
  return res.errors.map((e) => e.code)
}

describe("effect-vocab", () => {
  test("every builtin is recognized", () => {
    for (const e of BUILTIN_EFFECTS) expect(isEffectName(e)).toBe(true)
  })

  test("unknown name is rejected", () => {
    expect(isEffectName("nope.weird")).toBe(false)
  })

  test("extra vocabulary is honoured", () => {
    const extra = new Set(["db.write"])
    expect(isEffectName("db.write", extra)).toBe(true)
    expect(isEffectName("db.write")).toBe(false)
  })

  test("effectKindOf maps prefix or atom", () => {
    expect(effectKindOf("net.https")).toBe("net")
    expect(effectKindOf("fs.write")).toBe("fs")
    expect(effectKindOf("proc.spawn")).toBe("proc")
    expect(effectKindOf("time.read")).toBe("time")
    expect(effectKindOf("rand")).toBe("rand")
    expect(effectKindOf("log")).toBe("log")
    expect(effectKindOf("unknown.thing")).toBeUndefined()
  })
})

describe("@hewg-module", () => {
  test("minimal parses the module path", () => {
    const r = parse("module-minimal.ts")
    expect(r.errors).toEqual([])
    expect(r.annotations).toHaveLength(1)
    const a = r.annotations[0]!
    expect(a.kind).toBe("hewg-module")
    if (a.kind === "hewg-module") expect(a.path).toBe("payments/refund")
  })

  test("maximal accepts dashes and nested segments", () => {
    const r = parse("module-maximal.ts")
    expect(r.errors).toEqual([])
    const a = r.annotations[0]!
    if (a.kind === "hewg-module") expect(a.path).toBe("payments/stripe/refund-v2")
  })

  test("malformed path emits E0201", () => {
    const r = parse("module-malformed.ts")
    expect(codes(r)).toEqual(["E0201"])
    expect(r.annotations).toEqual([])
    expect(r.errors[0]!.line).toBe(2)
    expect(r.errors[0]!.col).toBeGreaterThanOrEqual(1)
  })
})

describe("@effects", () => {
  test("minimal single effect", () => {
    const r = parse("effects-minimal.ts")
    expect(r.errors).toEqual([])
    const a = r.annotations[0]!
    if (a.kind === "effects") expect(a.effects).toEqual(["log"])
  })

  test("maximal comma-separated list", () => {
    const r = parse("effects-maximal.ts")
    expect(r.errors).toEqual([])
    const a = r.annotations[0]!
    if (a.kind === "effects") {
      expect(a.effects).toEqual(["net.https", "fs.write", "log"])
    }
  })

  test("malformed missing commas emits E0201 with fix-syntax suggestion", () => {
    const r = parse("effects-malformed.ts")
    expect(codes(r)).toContain("E0201")
    expect(r.annotations).toEqual([])
    const diag = r.errors[0]!
    expect(diag.message).toContain("comma")
    expect(diag.suggest).toBeDefined()
    expect(diag.suggest![0]!.kind).toBe("fix-syntax")
    expect(diag.suggest![0]!.insert).toBe("net.https, fs.write")
  })

  test("bare @effects parses as pure declaration (no errors)", () => {
    const r = parse("effects-empty.ts")
    expect(r.errors).toEqual([])
    const a = r.annotations[0]!
    expect(a.kind).toBe("effects")
    if (a.kind === "effects") {
      expect(a.effects).toEqual([])
      expect(a.effectSpans).toEqual([])
    }
  })
})

describe("@cap", () => {
  test("minimal param-matching cap", () => {
    const r = parse("cap-minimal.ts")
    expect(r.errors).toEqual([])
    const a = r.annotations[0]!
    if (a.kind === "cap") {
      expect(a.param).toBe("log")
      expect(a.effect).toBe("log")
      expect(a.scope.kind).toBe("log")
    }
  })

  test("maximal net/fs/log caps with scopes", () => {
    const r = parse("cap-maximal.ts")
    expect(r.errors).toEqual([])
    expect(r.annotations).toHaveLength(3)
    const [http, fs, log] = r.annotations
    if (http?.kind === "cap" && http.scope.kind === "net") {
      expect(http.param).toBe("http")
      expect(http.scope.host).toBe("api.stripe.com")
      expect(http.scope.port).toBe(443)
      expect(http.scope.pathPrefix).toBe("/v1")
    } else {
      throw new Error("expected net cap first")
    }
    if (fs?.kind === "cap" && fs.scope.kind === "fs") {
      expect(fs.scope.prefix).toBe("./receipts/")
    } else {
      throw new Error("expected fs cap second")
    }
    if (log?.kind === "cap") {
      expect(log.scope.kind).toBe("log")
    } else {
      throw new Error("expected log cap third")
    }
  })

  test("malformed bad param emits E0202 with rename-arg suggestion", () => {
    const r = parse("cap-malformed-bad-param.ts")
    expect(codes(r)).toEqual(["E0202"])
    const diag = r.errors[0]!
    expect(diag.message).toContain("htpp")
    expect(diag.suggest).toBeDefined()
    expect(diag.suggest![0]!.kind).toBe("rename-arg")
    expect(diag.suggest![0]!.insert).toBe("http")
  })

  test("malformed bad scope key emits E0201", () => {
    const r = parse("cap-malformed-bad-scope.ts")
    expect(codes(r)).toContain("E0201")
    expect(r.annotations).toEqual([])
  })

  describe("quoted value escapes", () => {
    function parseCapValue(rawValue: string): {
      result: ParseResult
      value: string | undefined
    } {
      const src = [
        "/**",
        ` * @cap fs fs.write prefix=${rawValue}`,
        " */",
        "export function target(fs: unknown) { void fs }",
      ].join("\n")
      const sf = PROJECT.createSourceFile("__cap_escape__.ts", src, {
        overwrite: true,
      })
      const fn = sf.getFunctionOrThrow("target")
      const result = parseAnnotations(fn, { paramNames: ["fs"] })
      const cap = result.annotations.find((a) => a.kind === "cap")
      let value: string | undefined
      if (cap?.kind === "cap" && cap.scope.kind === "fs") {
        value = cap.scope.prefix
      }
      return { result, value }
    }

    test("escaped backslash in the middle decodes to a single backslash", () => {
      const { result, value } = parseCapValue('"a\\\\b"')
      expect(result.errors).toEqual([])
      expect(value).toBe("a\\b")
    })

    test("escaped quote decodes to a literal quote", () => {
      const { result, value } = parseCapValue('"\\\\\\""')
      expect(result.errors).toEqual([])
      expect(value).toBe("\\\"")
    })

    test("double escaped backslash decodes to two backslashes", () => {
      const { result, value } = parseCapValue('"\\\\\\\\"')
      expect(result.errors).toEqual([])
      expect(value).toBe("\\\\")
    })

    test("trailing escaped quote is rejected as unterminated", () => {
      const { result, value } = parseCapValue('"abc\\"')
      expect(codes(result)).toContain("E0201")
      expect(result.errors.some((d) => d.message.includes("unterminated"))).toBe(true)
      expect(value).toBeUndefined()
    })
  })
})

describe("@pre", () => {
  test("minimal expression", () => {
    const r = parse("pre-minimal.ts")
    expect(r.errors).toEqual([])
    const a = r.annotations[0]!
    if (a.kind === "pre") expect(a.expression).toBe("amountCents > 0")
  })

  test("maximal multiple preconditions", () => {
    const r = parse("pre-maximal.ts")
    expect(r.errors).toEqual([])
    expect(r.annotations).toHaveLength(2)
    const [p1, p2] = r.annotations
    if (p1?.kind === "pre") expect(p1.expression).toBe("amountCents > 0")
    if (p2?.kind === "pre") expect(p2.expression).toBe("chargeId.length === 18")
  })

  test("malformed expression emits E0501", () => {
    const r = parse("pre-malformed.ts")
    expect(codes(r)).toEqual(["E0501"])
    expect(r.errors[0]!.message).toContain("@pre expression")
  })
})

describe("@post", () => {
  test("minimal expression", () => {
    const r = parse("post-minimal.ts")
    expect(r.errors).toEqual([])
    const a = r.annotations[0]!
    if (a.kind === "post") expect(a.expression).toBe("result !== null")
  })

  test("maximal TS-valid implication via logical-or", () => {
    const r = parse("post-maximal.ts")
    expect(r.errors).toEqual([])
    const a = r.annotations[0]!
    if (a.kind === "post") {
      expect(a.expression).toBe("!result.ok || exists_receipt_file(result.val.id)")
    }
  })

  test("malformed expression emits E0501", () => {
    const r = parse("post-malformed.ts")
    expect(codes(r)).toEqual(["E0501"])
    expect(r.errors[0]!.message).toContain("@post expression")
  })
})

describe("@cost", () => {
  test("minimal known fields", () => {
    const r = parse("cost-minimal.ts")
    expect(r.errors).toEqual([])
    const a = r.annotations[0]!
    if (a.kind === "cost") {
      expect(a.fields).toHaveLength(2)
      const tokens = a.fields.find((f) => f.known && f.key === "tokens")!
      if (tokens.known && tokens.key === "tokens") expect(tokens.value).toBe(50)
      const ops = a.fields.find((f) => f.known && f.key === "ops")!
      if (ops.known && ops.key === "ops") {
        expect(ops.value).toBe(2)
        expect(ops.approx).toBe(false)
      }
    }
  })

  test("maximal with all known fields", () => {
    const r = parse("cost-maximal.ts")
    expect(r.errors).toEqual([])
    const a = r.annotations[0]!
    if (a.kind === "cost") {
      expect(a.fields.map((f) => f.key).sort()).toEqual([
        "fs",
        "net",
        "ops",
        "proc",
        "time",
        "tokens",
      ])
      const time = a.fields.find((f) => f.known && f.key === "time")!
      if (time.known && time.key === "time") expect(time.durationMs).toBe(5000)
      const ops = a.fields.find((f) => f.known && f.key === "ops")!
      if (ops.known && ops.key === "ops") expect(ops.approx).toBe(true)
    }
  })

  test("malformed unknown field emits W0001 and preserves raw", () => {
    const r = parse("cost-malformed-unknown-field.ts")
    expect(codes(r)).toEqual(["W0001"])
    const diag = r.errors[0]!
    expect(diag.severity).toBe("warning")
    expect(diag.suggest).toBeDefined()
    expect(diag.suggest![0]!.kind).toBe("fix-cost-field")
    expect(diag.suggest![0]!.insert).toBe("tokens")
    const a = r.annotations[0]!
    if (a.kind === "cost") {
      const unk = a.fields.find((f) => f.key === "tokenz")!
      expect("known" in unk && unk.known === false).toBe(true)
      expect(unk.raw).toBe("tokenz=120")
    }
  })

  test("malformed bad value emits E0501", () => {
    const r = parse("cost-malformed-bad-value.ts")
    const codeSet = new Set(codes(r))
    expect(codeSet.has("E0501")).toBe(true)
    expect(r.errors.length).toBeGreaterThanOrEqual(2)
  })
})

describe("end-to-end refund.ts", () => {
  test("correct refund parses all six tag kinds with zero errors", () => {
    const r = parse("refund-correct.ts", "refund")
    expect(r.errors).toEqual([])
    const kinds = r.annotations.map((a) => a.kind).sort()
    expect(kinds).toEqual([
      "cap",
      "cap",
      "cap",
      "cost",
      "effects",
      "hewg-module",
      "post",
      "pre",
    ])
    const http = r.annotations.find(
      (a) => a.kind === "cap" && a.param === "http",
    )!
    if (http.kind === "cap" && http.scope.kind === "net") {
      expect(http.scope.host).toBe("api.stripe.com")
      expect(http.scope.port).toBe(443)
    }
    const cost = r.annotations.find((a) => a.kind === "cost")!
    if (cost.kind === "cost") {
      const tokens = cost.fields.find((f) => f.known && f.key === "tokens")!
      if (tokens.known && tokens.key === "tokens") expect(tokens.value).toBe(120)
    }
  })

  test("broken refund produces all five expected diagnostic codes", () => {
    const r = parse("refund-broken.ts", "refund")
    const set = new Set(codes(r))
    expect(set.has("W0002")).toBe(true)
    expect(set.has("E0201")).toBe(true)
    expect(set.has("E0202")).toBe(true)
    expect(set.has("E0501")).toBe(true)
    expect(set.has("W0001")).toBe(true)
    for (const d of r.errors) {
      expect(d.line).toBeGreaterThanOrEqual(1)
      expect(d.col).toBeGreaterThanOrEqual(1)
      expect(d.docs).toMatch(/^https:\/\/hewg\.dev\/e\//)
    }
    const e0202 = r.errors.find((d) => d.code === "E0202" && d.message.includes("htpp"))!
    expect(e0202.suggest).toBeDefined()
    expect(e0202.suggest![0]!.insert).toBe("http")
  })
})

describe("robustness", () => {
  test("parser never throws on empty / degenerate bodies", () => {
    const src = [
      "/**",
      " * @effects",
      " * @cap",
      " * @cost tokens=",
      " * @pre )((",
      " * @post",
      " * @hewg-module",
      " */",
      "export function weird() {}",
    ].join("\n")
    const sf = PROJECT.createSourceFile("__weird__.ts", src, { overwrite: true })
    const fn = sf.getFunctionOrThrow("weird")
    expect(() => parseAnnotations(fn, { paramNames: [] })).not.toThrow()
    const r = parseAnnotations(fn, { paramNames: [] })
    expect(r.errors.length).toBeGreaterThan(0)
  })

  test("standard JSDoc tags like @param are ignored silently", () => {
    const src = [
      "/**",
      " * @param x the input",
      " * @returns something",
      " * @effects log",
      " */",
      "export function ignoresStandard(x: number) { return x }",
    ].join("\n")
    const sf = PROJECT.createSourceFile("__std__.ts", src, { overwrite: true })
    const fn = sf.getFunctionOrThrow("ignoresStandard")
    const r = parseAnnotations(fn, { paramNames: ["x"] })
    expect(r.errors).toEqual([])
    expect(r.annotations).toHaveLength(1)
    expect(r.annotations[0]!.kind).toBe("effects")
  })
})
