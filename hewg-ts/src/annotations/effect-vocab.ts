import type { CapEffectKind, EffectName } from "./types.ts"

export const BUILTIN_EFFECTS: readonly EffectName[] = [
  "net.http",
  "net.https",
  "net.tcp",
  "net.udp",
  "fs.read",
  "fs.write",
  "fs.exec",
  "proc.spawn",
  "proc.env",
  "proc.exit",
  "time.read",
  "time.sleep",
  "rand",
  "log",
]

const BUILTIN_SET: ReadonlySet<string> = new Set(BUILTIN_EFFECTS)

export function isEffectName(
  s: string,
  extra?: ReadonlySet<string>,
): boolean {
  if (BUILTIN_SET.has(s)) return true
  if (extra && extra.has(s)) return true
  return false
}

export function effectKindOf(effect: EffectName): CapEffectKind | undefined {
  if (effect === "rand") return "rand"
  if (effect === "log") return "log"
  const dot = effect.indexOf(".")
  const head = dot === -1 ? effect : effect.slice(0, dot)
  if (head === "net" || head === "fs" || head === "proc" || head === "time") {
    return head
  }
  return undefined
}
