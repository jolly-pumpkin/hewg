import type { ContentBlock, ModelClient, ModelRequest, ModelResponse } from "./anthropic-client.ts"
import type { ToolSchema } from "./types.ts"

/**
 * @hewg-module bench/lib/ollama-client
 */

export type OllamaClientOptions = {
  baseUrl?: string // defaults to http://localhost:11434
  requestTimeoutMs?: number // defaults to 300_000 (5 minutes)
}

/**
 * Create a ModelClient that talks to a local Ollama instance via the
 * OpenAI-compatible chat completions endpoint.
 *
 * @effects net.http
 */
export function createOllamaClient(opts?: OllamaClientOptions): ModelClient {
  const baseUrl = opts?.baseUrl ?? "http://localhost:11434"
  const timeoutMs = opts?.requestTimeoutMs ?? 300_000 // 5 minutes

  return {
    async send(req: ModelRequest): Promise<ModelResponse> {
      const body = {
        model: req.model,
        messages: buildMessages(req),
        tools: buildTools(req.tools),
        stream: false,
        options: {
          temperature: req.temperature,
          num_predict: req.maxOutputTokens,
        },
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      let res: Response
      try {
        res = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
      } catch (e: unknown) {
        clearTimeout(timer)
        if (e instanceof Error && e.name === "AbortError") {
          throw new Error(
            `ollama: request timed out after ${timeoutMs}ms — the model may be too slow or unresponsive`,
          )
        }
        throw e
      }
      clearTimeout(timer)

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`ollama: ${res.status} ${res.statusText}: ${text}`)
      }

      const json = (await res.json()) as OllamaChatResponse
      return parseResponse(json)
    },
  }
}

// --- Message translation (Anthropic format → Ollama/OpenAI format) ---

type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content?: string
  tool_calls?: OllamaToolCall[]
  tool_call_id?: string
}

type OllamaToolCall = {
  id: string
  type: "function"
  function: { name: string; arguments: Record<string, unknown> }
}

type OllamaTool = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

type OllamaChatResponse = {
  message: {
    role: string
    content?: string
    tool_calls?: OllamaToolCall[]
  }
  eval_count?: number
  prompt_eval_count?: number
}

function buildMessages(req: ModelRequest): OllamaMessage[] {
  const out: OllamaMessage[] = []

  // System prompt
  out.push({ role: "system", content: req.system })

  // Convert Anthropic message array
  for (const msg of req.messages) {
    if (msg.role === "user") {
      // User messages can contain text and tool_results
      const textParts: string[] = []
      const toolResults: OllamaMessage[] = []

      for (const block of msg.content) {
        if (block.type === "text") {
          textParts.push(block.text)
        } else if (block.type === "tool_result") {
          toolResults.push({
            role: "tool",
            content: block.content,
            tool_call_id: block.tool_use_id,
          })
        }
      }

      // If there are only tool results, emit them directly
      if (textParts.length === 0 && toolResults.length > 0) {
        out.push(...toolResults)
      } else if (textParts.length > 0 && toolResults.length === 0) {
        out.push({ role: "user", content: textParts.join("\n") })
      } else {
        // Mixed: tool results first, then user text
        out.push(...toolResults)
        if (textParts.length > 0) {
          out.push({ role: "user", content: textParts.join("\n") })
        }
      }
    } else if (msg.role === "assistant") {
      const textParts: string[] = []
      const toolCalls: OllamaToolCall[] = []

      for (const block of msg.content) {
        if (block.type === "text") {
          textParts.push(block.text)
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: { name: block.name, arguments: block.input },
          })
        }
      }

      const assistantMsg: OllamaMessage = { role: "assistant" }
      if (textParts.length > 0) assistantMsg.content = textParts.join("\n")
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls
      out.push(assistantMsg)
    }
  }

  return out
}

function buildTools(schemas: ToolSchema[]): OllamaTool[] {
  return schemas.map((s) => ({
    type: "function" as const,
    function: {
      name: s.name,
      description: s.description,
      parameters: s.input_schema,
    },
  }))
}

function parseResponse(json: OllamaChatResponse): ModelResponse {
  const content: ContentBlock[] = []
  const msg = json.message

  if (msg.content && msg.content.trim().length > 0) {
    content.push({ type: "text", text: msg.content })
  }

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    for (const tc of msg.tool_calls) {
      content.push({
        type: "tool_use",
        id: tc.id || `call_${Math.random().toString(36).slice(2, 10)}`,
        name: tc.function.name,
        input: tc.function.arguments ?? {},
      })
    }
  }

  // If model returned nothing at all, add empty text to avoid undefined behavior
  if (content.length === 0) {
    content.push({ type: "text", text: "" })
  }

  const stopReason = msg.tool_calls && msg.tool_calls.length > 0 ? "tool_use" : "end_turn"

  return {
    content,
    stopReason,
    usage: {
      input: json.prompt_eval_count ?? 0,
      output: json.eval_count ?? 0,
    },
  }
}
