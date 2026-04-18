import { describe, expect, test } from "bun:test"
import { scopeSatisfies } from "../../src/analysis/cap-flow.ts"
import type { CapScope } from "../../src/annotations/types.ts"

describe("scopeSatisfies — kind mismatch", () => {
  test("different kinds never satisfy", () => {
    const net: CapScope = { kind: "net", host: "a.com" }
    const fs: CapScope = { kind: "fs", prefix: "./x/" }
    expect(scopeSatisfies(net, fs)).toBe(false)
    expect(scopeSatisfies(fs, net)).toBe(false)
  })
})

describe("scopeSatisfies — net", () => {
  test("exact host + port match", () => {
    const caller: CapScope = { kind: "net", host: "api.stripe.com", port: 443 }
    const callee: CapScope = { kind: "net", host: "api.stripe.com", port: 443 }
    expect(scopeSatisfies(caller, callee)).toBe(true)
  })

  test("host mismatch", () => {
    const caller: CapScope = { kind: "net", host: "api.paypal.com" }
    const callee: CapScope = { kind: "net", host: "api.stripe.com" }
    expect(scopeSatisfies(caller, callee)).toBe(false)
  })

  test("port mismatch", () => {
    const caller: CapScope = { kind: "net", host: "api.stripe.com", port: 80 }
    const callee: CapScope = { kind: "net", host: "api.stripe.com", port: 443 }
    expect(scopeSatisfies(caller, callee)).toBe(false)
  })

  test("caller omits host = wildcard, satisfies", () => {
    const caller: CapScope = { kind: "net" }
    const callee: CapScope = { kind: "net", host: "api.stripe.com" }
    expect(scopeSatisfies(caller, callee)).toBe(true)
  })

  test("callee omits host, caller constrains: still satisfies", () => {
    const caller: CapScope = { kind: "net", host: "api.stripe.com" }
    const callee: CapScope = { kind: "net" }
    expect(scopeSatisfies(caller, callee)).toBe(true)
  })

  test("path_prefix: caller wider satisfies narrower callee", () => {
    const caller: CapScope = { kind: "net", pathPrefix: "/api/" }
    const callee: CapScope = { kind: "net", pathPrefix: "/api/v1/" }
    expect(scopeSatisfies(caller, callee)).toBe(true)
  })

  test("path_prefix: caller narrower than callee does not satisfy", () => {
    const caller: CapScope = { kind: "net", pathPrefix: "/api/v1/" }
    const callee: CapScope = { kind: "net", pathPrefix: "/api/" }
    expect(scopeSatisfies(caller, callee)).toBe(false)
  })
})

describe("scopeSatisfies — fs", () => {
  test("exact prefix satisfies", () => {
    const caller: CapScope = { kind: "fs", prefix: "./receipts/" }
    const callee: CapScope = { kind: "fs", prefix: "./receipts/" }
    expect(scopeSatisfies(caller, callee)).toBe(true)
  })

  test("caller wider prefix satisfies narrower callee", () => {
    const caller: CapScope = { kind: "fs", prefix: "./data/" }
    const callee: CapScope = { kind: "fs", prefix: "./data/logs/" }
    expect(scopeSatisfies(caller, callee)).toBe(true)
  })

  test("caller narrower prefix does not satisfy wider callee", () => {
    const caller: CapScope = { kind: "fs", prefix: "./data/logs/" }
    const callee: CapScope = { kind: "fs", prefix: "./data/" }
    expect(scopeSatisfies(caller, callee)).toBe(false)
  })

  test("caller omits prefix = wildcard, satisfies", () => {
    const caller: CapScope = { kind: "fs" }
    const callee: CapScope = { kind: "fs", prefix: "./receipts/" }
    expect(scopeSatisfies(caller, callee)).toBe(true)
  })

  test("disjoint prefixes do not satisfy", () => {
    const caller: CapScope = { kind: "fs", prefix: "./a/" }
    const callee: CapScope = { kind: "fs", prefix: "./b/" }
    expect(scopeSatisfies(caller, callee)).toBe(false)
  })
})

describe("scopeSatisfies — proc", () => {
  test("callee empty allowlist: any caller satisfies", () => {
    const caller: CapScope = { kind: "proc", cmdAllowlist: ["ls"] }
    const callee: CapScope = { kind: "proc" }
    expect(scopeSatisfies(caller, callee)).toBe(true)
  })

  test("caller superset satisfies callee subset", () => {
    const caller: CapScope = { kind: "proc", cmdAllowlist: ["npm", "node", "ls"] }
    const callee: CapScope = { kind: "proc", cmdAllowlist: ["npm", "node"] }
    expect(scopeSatisfies(caller, callee)).toBe(true)
  })

  test("caller missing a required command does not satisfy", () => {
    const caller: CapScope = { kind: "proc", cmdAllowlist: ["npm"] }
    const callee: CapScope = { kind: "proc", cmdAllowlist: ["npm", "node"] }
    expect(scopeSatisfies(caller, callee)).toBe(false)
  })

  test("caller omits allowlist: treated as wildcard only when callee also omits", () => {
    const caller: CapScope = { kind: "proc" }
    const callee: CapScope = { kind: "proc", cmdAllowlist: ["npm"] }
    // Caller has empty allowlist; cannot satisfy a non-empty callee requirement.
    expect(scopeSatisfies(caller, callee)).toBe(false)
  })
})

describe("scopeSatisfies — scope-free kinds", () => {
  test("time always satisfies time", () => {
    expect(scopeSatisfies({ kind: "time" }, { kind: "time" })).toBe(true)
  })

  test("rand always satisfies rand", () => {
    expect(scopeSatisfies({ kind: "rand" }, { kind: "rand" })).toBe(true)
  })

  test("log always satisfies log", () => {
    expect(scopeSatisfies({ kind: "log" }, { kind: "log" })).toBe(true)
  })
})
