/**
 * @hewg-module contract/types
 */
export type ContractCapJson =
  | { kind: string; host?: string; port?: number; path_prefix?: string }
  | { kind: string; prefix?: string }
  | { kind: string; cmd_allowlist?: readonly string[] }
  | { kind: string }

export type ContractCostJson = Record<string, number | string>

export type ContractJson = {
  symbol: string
  signature: string
  effects: readonly string[] | null
  caps: Record<string, ContractCapJson> | null
  pre: readonly string[] | null
  post: readonly string[] | null
  cost: ContractCostJson | null
  errors: readonly string[] | null
  source: { file: string; line: number }
}
