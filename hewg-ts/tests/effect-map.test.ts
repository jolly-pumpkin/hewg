import { describe, expect, test } from "bun:test"
import builtinData from "../stdlib/effect-map.json" with { type: "json" }
import {
  BUILTIN_EFFECT_MAP_DATA,
  loadBuiltinEffectMap,
  loadEffectMap,
  type EffectMapData,
  type EffectMapEntry,
} from "../src/analysis/effect-map.ts"
import { BUILTIN_EFFECTS } from "../src/annotations/effect-vocab.ts"

const data = builtinData as EffectMapData

describe("effect-map: file shape", () => {
  test("version is 1", () => {
    expect(data.version).toBe(1)
  })

  test("BUILTIN_EFFECT_MAP_DATA is the parsed JSON", () => {
    expect(BUILTIN_EFFECT_MAP_DATA.version).toBe(1)
    expect(BUILTIN_EFFECT_MAP_DATA.entries).toBe(data.entries)
  })

  test("entries object is non-empty", () => {
    expect(Object.keys(data.entries).length).toBeGreaterThan(0)
  })

  test("every entry references only built-in effect names", () => {
    const known = new Set(BUILTIN_EFFECTS)
    for (const [key, entry] of Object.entries(data.entries)) {
      for (const effect of entry.effects) {
        expect(known.has(effect)).toBe(true)
        if (!known.has(effect)) {
          throw new Error(`entry "${key}" has unknown effect "${effect}"`)
        }
      }
    }
  })

  test("no duplicate effect names within a single entry", () => {
    for (const [key, entry] of Object.entries(data.entries)) {
      const seen = new Set<string>()
      for (const e of entry.effects) {
        expect(seen.has(e)).toBe(false)
        if (seen.has(e)) throw new Error(`entry "${key}" has duplicate effect "${e}"`)
        seen.add(e)
      }
    }
  })
})

describe("effect-map: every built-in entry has a test", () => {
  const map = loadBuiltinEffectMap()
  for (const [key, entry] of Object.entries(data.entries)) {
    test(`${key} -> [${entry.effects.join(", ")}]`, () => {
      expect(map.effectsOf(key)).toEqual(entry.effects)
    })
  }
})

describe("effect-map: query semantics", () => {
  const map = loadBuiltinEffectMap()

  test("fetch returns ['net.https']", () => {
    expect(map.effectsOf("fetch")).toEqual(["net.https"])
  })

  test("node:fs.readFile returns ['fs.read']", () => {
    expect(map.effectsOf("node:fs.readFile")).toEqual(["fs.read"])
  })

  test("node:fs.copyFile returns both read and write effects", () => {
    expect(map.effectsOf("node:fs.copyFile")).toEqual(["fs.read", "fs.write"])
  })

  test("Math.random returns ['rand']", () => {
    expect(map.effectsOf("Math.random")).toEqual(["rand"])
  })

  test("console.log returns ['log']", () => {
    expect(map.effectsOf("console.log")).toEqual(["log"])
  })

  test("unknown symbol returns undefined", () => {
    expect(map.effectsOf("does.not.exist")).toBeUndefined()
  })

  test("empty-string symbol returns undefined", () => {
    expect(map.effectsOf("")).toBeUndefined()
  })

  test("known-pure entry returns empty array (not undefined)", () => {
    expect(map.effectsOf("node-cron.validate")).toEqual([])
  })

  test("has() mirrors effectsOf presence", () => {
    expect(map.has("fetch")).toBe(true)
    expect(map.has("does.not.exist")).toBe(false)
    expect(map.has("node-cron.validate")).toBe(true)
  })

  test("size reflects number of entries", () => {
    expect(map.size()).toBe(Object.keys(data.entries).length)
  })

  test("builtinKeys lists every entry exactly once", () => {
    const keys = map.builtinKeys()
    expect(keys.length).toBe(Object.keys(data.entries).length)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("effect-map: user override merge", () => {
  test("user entry overrides a built-in (not append)", () => {
    const m = loadEffectMap({ fetch: { effects: ["net.http"] } })
    expect(m.effectsOf("fetch")).toEqual(["net.http"])
  })

  test("user entry for a new symbol coexists with built-ins", () => {
    const m = loadEffectMap({ "my.lib.call": { effects: ["log"] } })
    expect(m.effectsOf("my.lib.call")).toEqual(["log"])
    expect(m.effectsOf("fetch")).toEqual(["net.https"])
  })

  test("built-ins remain queryable without override", () => {
    const m = loadEffectMap()
    expect(m.effectsOf("node:fs.readFile")).toEqual(["fs.read"])
  })

  test("empty user map is equivalent to no user map", () => {
    const m1 = loadEffectMap()
    const m2 = loadEffectMap({})
    expect(m2.size()).toBe(m1.size())
  })

  test("user can override multiple built-ins independently", () => {
    const m = loadEffectMap({
      fetch: { effects: ["net.http"] },
      "console.log": { effects: [] },
    })
    expect(m.effectsOf("fetch")).toEqual(["net.http"])
    expect(m.effectsOf("console.log")).toEqual([])
    expect(m.effectsOf("Math.random")).toEqual(["rand"])
  })
})

describe("effect-map: validation rejects malformed entries", () => {
  test("unknown effect name in user entry throws", () => {
    expect(() =>
      loadEffectMap({ "bad.symbol": { effects: ["not.a.real.effect"] as unknown as [] } }),
    ).toThrow(/unknown effect/)
  })

  test("non-array effects in user entry throws", () => {
    const bad = { "bad.symbol": { effects: "log" as unknown as [] } } as Record<string, EffectMapEntry>
    expect(() => loadEffectMap(bad)).toThrow(/invalid effects/)
  })

  test("non-string effect in user entry throws", () => {
    const bad = {
      "bad.symbol": { effects: [42] as unknown as [] },
    } as Record<string, EffectMapEntry>
    expect(() => loadEffectMap(bad)).toThrow(/non-string effect/)
  })
})

describe("effect-map: coverage smoke checks", () => {
  const map = loadBuiltinEffectMap()

  test("all Web standard entries are present", () => {
    const required = [
      "fetch",
      "XMLHttpRequest",
      "WebSocket",
      "crypto.getRandomValues",
      "localStorage.getItem",
      "localStorage.setItem",
      "sessionStorage.getItem",
      "sessionStorage.setItem",
      "console.log",
      "console.error",
    ]
    for (const key of required) expect(map.has(key)).toBe(true)
  })

  test("all required Node built-in modules have at least one entry", () => {
    const modules = [
      "node:fs.",
      "node:fs/promises.",
      "node:http.",
      "node:https.",
      "node:child_process.",
      "node:process.",
      "node:os.",
      "node:crypto.",
    ]
    const keys = map.builtinKeys()
    for (const prefix of modules) {
      expect(keys.some((k) => k.startsWith(prefix))).toBe(true)
    }
  })

  test("each of the 20 npm packages has at least one entry", () => {
    const packages = [
      "axios",
      "node-fetch",
      "got",
      "ky",
      "pg.",
      "mysql2",
      "redis.",
      "ioredis",
      "mongoose",
      "prisma.",
      "nodemailer",
      "express.",
      "winston.",
      "pino.",
      "dotenv.",
      "node-cron.",
      "ws.",
      "socket.io",
      "bull.",
      "jsonwebtoken.",
    ]
    const keys = map.builtinKeys()
    for (const pkg of packages) {
      const found = keys.some((k) => k === pkg.replace(/\.$/, "") || k.startsWith(pkg))
      expect(found).toBe(true)
      if (!found) throw new Error(`no entries found for npm package "${pkg}"`)
    }
  })
})
