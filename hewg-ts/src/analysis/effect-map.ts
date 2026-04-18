import type { EffectName } from "../annotations/types.ts"
import builtinData from "../../stdlib/effect-map.json" with { type: "json" }
import { BUILTIN_EFFECTS } from "../annotations/effect-vocab.ts"

export type EffectMapEntry = {
  effects: readonly EffectName[]
  note?: string
}

export type EffectMapData = {
  version: 1
  entries: Record<string, EffectMapEntry>
}

export interface EffectMap {
  effectsOf(symbol: string): readonly EffectName[] | undefined
  size(): number
  builtinKeys(): readonly string[]
  has(symbol: string): boolean
}

const BUILTIN_EFFECT_SET: ReadonlySet<string> = new Set(BUILTIN_EFFECTS)

function validateEntry(key: string, entry: EffectMapEntry): void {
  if (!Array.isArray(entry.effects)) {
    throw new Error(`effect-map entry "${key}" has invalid effects (expected array)`)
  }
  for (const e of entry.effects) {
    if (typeof e !== "string") {
      throw new Error(`effect-map entry "${key}" has non-string effect`)
    }
    if (!BUILTIN_EFFECT_SET.has(e)) {
      throw new Error(
        `effect-map entry "${key}" references unknown effect "${e}" (not in BUILTIN_EFFECTS)`,
      )
    }
  }
}

function buildMap(merged: Record<string, EffectMapEntry>): EffectMap {
  const frozen = new Map<string, readonly EffectName[]>()
  for (const [key, entry] of Object.entries(merged)) {
    frozen.set(key, Object.freeze([...entry.effects]))
  }
  const keys = Object.freeze([...frozen.keys()])
  return {
    effectsOf(symbol) {
      return frozen.get(symbol)
    },
    size() {
      return frozen.size
    },
    builtinKeys() {
      return keys
    },
    has(symbol) {
      return frozen.has(symbol)
    },
  }
}

export function loadBuiltinEffectMap(): EffectMap {
  const data = builtinData as EffectMapData
  if (data.version !== 1) {
    throw new Error(`effect-map.json: unsupported version ${String(data.version)}`)
  }
  for (const [key, entry] of Object.entries(data.entries)) {
    validateEntry(key, entry)
  }
  return buildMap(data.entries)
}

export function loadEffectMap(
  userEntries?: Record<string, EffectMapEntry>,
): EffectMap {
  const data = builtinData as EffectMapData
  if (data.version !== 1) {
    throw new Error(`effect-map.json: unsupported version ${String(data.version)}`)
  }
  const merged: Record<string, EffectMapEntry> = { ...data.entries }
  if (userEntries) {
    for (const [key, entry] of Object.entries(userEntries)) {
      validateEntry(key, entry)
      merged[key] = entry
    }
  }
  for (const [key, entry] of Object.entries(data.entries)) {
    if (merged[key] === entry) validateEntry(key, entry)
  }
  return buildMap(merged)
}

export const BUILTIN_EFFECT_MAP_DATA: EffectMapData = builtinData as EffectMapData
