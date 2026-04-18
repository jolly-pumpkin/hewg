import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import type { EffectMapEntry } from "./analysis/effect-map.ts"

export type UnknownEffectPolicy = "warn" | "pure"

export type CheckConfig = {
  depthLimit: number
  unknownEffectPolicy: UnknownEffectPolicy
}

export type HewgConfig = {
  effectMap?: Record<string, EffectMapEntry>
  check: CheckConfig
}

export const DEFAULT_CHECK: CheckConfig = {
  depthLimit: 10,
  unknownEffectPolicy: "warn",
}

export function loadHewgConfig(tsconfigPath: string): HewgConfig {
  const cfgPath = resolve(dirname(tsconfigPath), "hewg.config.json")
  if (!existsSync(cfgPath)) {
    return { check: { ...DEFAULT_CHECK } }
  }
  const raw = readFileSync(cfgPath, "utf8")
  const parsed = JSON.parse(raw) as {
    effectMap?: Record<string, EffectMapEntry>
    check?: Partial<CheckConfig>
  }
  const check: CheckConfig = {
    depthLimit: parsed.check?.depthLimit ?? DEFAULT_CHECK.depthLimit,
    unknownEffectPolicy:
      parsed.check?.unknownEffectPolicy ?? DEFAULT_CHECK.unknownEffectPolicy,
  }
  const out: HewgConfig = { check }
  if (parsed.effectMap !== undefined) out.effectMap = parsed.effectMap
  return out
}
