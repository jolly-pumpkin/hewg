import { appendFileSync } from "node:fs"
import type { ModelClient, ModelMessage, UserContent } from "./anthropic-client.ts"
import type { ToolBundle } from "./tools.ts"
import type { StopReason, ToolCall, TurnLog } from "./types.ts"

/**
 * @hewg-module bench/lib/agent-loop
 */

export type AgentLoopOptions = {
  client: ModelClient
  model: string
  system: string
  tools: ToolBundle
  task: string
  iterationBudget: number
  tokenBudget: number
  temperature: number
  maxOutputTokens: number
  logPath: string
  resumeFrom?: ReadonlyArray<TurnLog>
  rng: () => number
}

export type AgentLoopResult = {
  iterations: number
  tokensInput: number
  tokensOutput: number
  stop: StopReason
}

const DONE_MARKER = /\bDONE\b/
const GIVE_UP_MARKER = /\bGIVE\s+UP\b/

/**
 * @hewg-module bench/lib/agent-loop
 * @effects net.https, fs.read, fs.write
 */
export async function runAgentLoop(opts: AgentLoopOptions): Promise<AgentLoopResult> {
  const messages: ModelMessage[] = []
  let iterations = 0
  let tokensInput = 0
  let tokensOutput = 0

  // The initial user message always comes first.
  messages.push({ role: "user", content: [{ type: "text", text: opts.task }] })
  if (opts.resumeFrom !== undefined && opts.resumeFrom.length > 0) {
    const replayed = replayMessages(opts.resumeFrom)
    messages.push(...replayed.messages)
    iterations = replayed.iterations
    tokensInput = replayed.tokensInput
    tokensOutput = replayed.tokensOutput
  }

  let stop: StopReason = "end-turn"
  while (iterations < opts.iterationBudget) {
    if (tokensInput + tokensOutput > opts.tokenBudget) {
      stop = "token-budget"
      appendTurn(opts.logPath, {
        kind: "system",
        iteration: iterations,
        message: `token budget exceeded: ${tokensInput + tokensOutput} > ${opts.tokenBudget}`,
      })
      break
    }

    iterations += 1
    let response
    try {
      response = await opts.client.send({
        model: opts.model,
        system: opts.system,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
        tools: opts.tools.schemas,
        messages,
      })
    } catch (e) {
      stop = "model-error"
      appendTurn(opts.logPath, {
        kind: "system",
        iteration: iterations,
        message: `model error: ${(e as Error).message}`,
      })
      break
    }

    const text = extractText(response.content)
    const toolCalls = extractToolCalls(response.content)
    tokensInput += response.usage.input
    tokensOutput += response.usage.output

    appendTurn(opts.logPath, {
      kind: "assistant",
      iteration: iterations,
      text,
      toolCalls,
      usage: response.usage,
      stopReason: response.stopReason,
    })

    messages.push({ role: "assistant", content: response.content })

    if (toolCalls.length === 0) {
      // No tool use: the model is replying. Decide based on the text.
      if (DONE_MARKER.test(text)) {
        stop = "done"
        break
      }
      if (GIVE_UP_MARKER.test(text)) {
        stop = "give-up"
        break
      }
      // Otherwise: nudge the model back into the loop.
      const nudge: UserContent[] = [
        {
          type: "text",
          text: "Continue. Use a tool or reply with `DONE` or `GIVE UP`.",
        },
      ]
      messages.push({ role: "user", content: nudge })
      continue
    }

    // Execute tool calls and pipe results back.
    const toolOutputs: UserContent[] = []
    for (const call of toolCalls) {
      const result = opts.tools.execute(call.id, call.name, call.input)
      appendTurn(opts.logPath, {
        kind: "tool-result",
        iteration: iterations,
        toolUseId: result.toolUseId,
        toolName: call.name,
        content: result.content,
        isError: result.isError,
      })
      toolOutputs.push({
        type: "tool_result",
        tool_use_id: result.toolUseId,
        content: truncate(result.content, 16_000),
        is_error: result.isError,
      })
    }
    messages.push({ role: "user", content: toolOutputs })
  }

  if (iterations >= opts.iterationBudget && stop === "end-turn") stop = "iteration-budget"

  // Satisfy pure-ish linter: use rng for determinism side channel.
  void opts.rng

  return { iterations, tokensInput, tokensOutput, stop }
}

function extractText(content: Array<{ type: string } & Record<string, unknown>>): string {
  const parts: string[] = []
  for (const b of content) {
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text)
  }
  return parts.join("\n").trim()
}

function extractToolCalls(content: Array<{ type: string } & Record<string, unknown>>): ToolCall[] {
  const out: ToolCall[] = []
  for (const b of content) {
    if (b.type !== "tool_use") continue
    out.push({
      id: String(b.id ?? ""),
      name: String(b.name ?? ""),
      input: (b.input as Record<string, unknown>) ?? {},
    })
  }
  return out
}

function appendTurn(path: string, turn: TurnLog): void {
  appendFileSync(path, JSON.stringify(turn) + "\n")
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n[... truncated ${s.length - max} bytes ...]`
}

type Replayed = {
  messages: ModelMessage[]
  iterations: number
  tokensInput: number
  tokensOutput: number
}

function replayMessages(log: ReadonlyArray<TurnLog>): Replayed {
  // Drop any trailing assistant turn whose tool_calls don't all have
  // matching tool-result entries — that turn crashed mid-execution and must
  // be re-emitted by the model.
  const trimmed = trimPartialTail(log)

  const messages: ModelMessage[] = []
  let iterations = 0
  let tokensInput = 0
  let tokensOutput = 0
  let pendingToolResults: UserContent[] = []
  for (const turn of trimmed) {
    if (turn.kind === "assistant") {
      if (pendingToolResults.length > 0) {
        messages.push({ role: "user", content: pendingToolResults })
        pendingToolResults = []
      }
      const blocks: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }> = []
      if (turn.text !== "") blocks.push({ type: "text", text: turn.text })
      for (const tc of turn.toolCalls) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input })
      }
      messages.push({ role: "assistant", content: blocks })
      iterations = turn.iteration
      tokensInput += turn.usage.input
      tokensOutput += turn.usage.output
    } else if (turn.kind === "tool-result") {
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: turn.toolUseId,
        content: turn.content,
        is_error: turn.isError,
      })
    }
  }
  if (pendingToolResults.length > 0) {
    messages.push({ role: "user", content: pendingToolResults })
  }
  return { messages, iterations, tokensInput, tokensOutput }
}

function trimPartialTail(log: ReadonlyArray<TurnLog>): TurnLog[] {
  const out: TurnLog[] = [...log]
  // Walk backward: find the last assistant turn. Check that each of its
  // toolCalls has a matching tool-result after it in the log.
  for (let i = out.length - 1; i >= 0; i--) {
    const turn = out[i]!
    if (turn.kind !== "assistant") continue
    const expected = new Set(turn.toolCalls.map((c) => c.id))
    for (let j = i + 1; j < out.length; j++) {
      const post = out[j]!
      if (post.kind === "tool-result") expected.delete(post.toolUseId)
    }
    if (expected.size > 0) {
      // Drop everything from this assistant turn onward.
      return out.slice(0, i)
    }
    return out
  }
  return out
}
