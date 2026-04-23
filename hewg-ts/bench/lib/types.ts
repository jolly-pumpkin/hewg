/**
 * @hewg-module bench/lib/types
 */

export type Condition = 1 | 2 | 2.5 | 3 | 4

export type BenchConfig = {
  version: 1
  model: string
  iterationBudget: number
  tokenBudget: number
  repetitions: number
  seeds: number[]
  temperature: number
  maxOutputTokens: number
  prompts: Record<string, string>
  tools: {
    all: string[]
    condition4: string[]
  }
  retry: {
    attempts: number
    backoffMs: number[]
  }
}

export type TaskSpec = {
  id: string
  description: string
  conditions: Record<string, string>
  test: string
}

export type ToolSchema = {
  name: string
  description: string
  input_schema: {
    type: "object"
    properties: Record<string, unknown>
    required: string[]
  }
}

export type StopReason =
  | "done"
  | "give-up"
  | "iteration-budget"
  | "token-budget"
  | "end-turn"
  | "model-error"

export type ToolCall = {
  id: string
  name: string
  input: Record<string, unknown>
}

export type ToolResult = {
  toolUseId: string
  content: string
  isError: boolean
}

export type TurnLog =
  | {
      kind: "assistant"
      iteration: number
      text: string
      toolCalls: ToolCall[]
      usage: { input: number; output: number }
      stopReason: string | null
    }
  | {
      kind: "tool-result"
      iteration: number
      toolUseId: string
      toolName: string
      content: string
      isError: boolean
    }
  | {
      kind: "system"
      iteration: number
      message: string
    }

export type RunMetrics = {
  success: boolean
  iterations: number
  tokensInput: number
  tokensOutput: number
  hallucinatedSymbols: number | null
  effectViolations: number | null
  filesReadBeforeFirstCorrectEdit: number | null
  backtrackingEvents: number | null
  stop: StopReason
}

export type RunResult = {
  task: string
  condition: Condition
  seed: number
  configSnapshot: BenchConfig
  startedAt: string
  finishedAt: string
  metrics: RunMetrics
  patchPath: string
}
