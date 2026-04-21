import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import type { EffectMapEntry } from "./analysis/effect-map.ts"

export type UnknownEffectPolicy = "warn" | "pure"
export type PackagePolicy = "pure" | "warn"
export type PackageConfig = { defaultPolicy: PackagePolicy }

export type CheckConfig = {
  depthLimit: number
  unknownEffectPolicy: UnknownEffectPolicy
  defaultPackagePolicy?: PackagePolicy
}

export type BaselineConfig = {
  strict?: boolean
}

export type HewgConfig = {
  effectMap?: Record<string, EffectMapEntry>
  packages?: Record<string, PackageConfig>
  check: CheckConfig
  baseline?: BaselineConfig
}

export const DEFAULT_CHECK: CheckConfig = {
  depthLimit: 10,
  unknownEffectPolicy: "warn",
}

/**
 * @hewg-module config
 * @effects fs.read
 */
export function loadHewgConfig(tsconfigPath: string): HewgConfig {
  const cfgPath = resolve(dirname(tsconfigPath), "hewg.config.json")
  if (!existsSync(cfgPath)) {
    return { check: { ...DEFAULT_CHECK } }
  }
  const raw = readFileSync(cfgPath, "utf8")
  const parsed = JSON.parse(raw) as {
    effectMap?: Record<string, EffectMapEntry>
    packages?: Record<string, PackageConfig>
    check?: Partial<CheckConfig>
    baseline?: BaselineConfig
  }
  const check: CheckConfig = {
    depthLimit: parsed.check?.depthLimit ?? DEFAULT_CHECK.depthLimit,
    unknownEffectPolicy:
      parsed.check?.unknownEffectPolicy ?? DEFAULT_CHECK.unknownEffectPolicy,
    defaultPackagePolicy: parsed.check?.defaultPackagePolicy,
  }
  const out: HewgConfig = { check }
  if (parsed.effectMap !== undefined) out.effectMap = parsed.effectMap
  if (parsed.packages !== undefined) out.packages = parsed.packages
  if (parsed.baseline !== undefined) out.baseline = parsed.baseline
  return out
}
