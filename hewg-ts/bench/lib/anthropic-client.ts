import type { ToolSchema } from "./types.ts"

/**
 * @hewg-module bench/lib/anthropic-client
 */

// Content blocks in an assistant response.
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }

export type ModelMessage =
  | { role: "user"; content: UserContent[] }
  | { role: "assistant"; content: ContentBlock[] }

export type UserContent =
  | { type: "text"; text: string }
  | {
      type: "tool_result"
      tool_use_id: string
      content: string
      is_error?: boolean
    }

export type ModelResponse = {
  content: ContentBlock[]
  stopReason: string | null
  usage: { input: number; output: number }
}

export type ModelRequest = {
  model: string
  system: string
  temperature: number
  maxOutputTokens: number
  tools: ToolSchema[]
  messages: ModelMessage[]
}

export type ModelClient = {
  send(req: ModelRequest): Promise<ModelResponse>
}

export type RetryConfig = {
  attempts: number
  backoffMs: number[]
}

/**
 * @hewg-module bench/lib/anthropic-client
 * @effects net.https
 * @cap apiKey net.https host="api.anthropic.com" port=443
 */
export function createAnthropicClient(apiKey: string, retry: RetryConfig): ModelClient {
  return {
    async send(req: ModelRequest): Promise<ModelResponse> {
      return sendWithRetry(apiKey, req, retry)
    },
  }
}

async function sendWithRetry(
  apiKey: string,
  req: ModelRequest,
  retry: RetryConfig,
): Promise<ModelResponse> {
  let lastErr: unknown = undefined
  for (let attempt = 0; attempt < retry.attempts; attempt++) {
    try {
      return await sendOnce(apiKey, req)
    } catch (e) {
      lastErr = e
      if (!isRetryable(e) || attempt === retry.attempts - 1) throw e
      const backoff = retry.backoffMs[attempt] ?? retry.backoffMs[retry.backoffMs.length - 1] ?? 2000
      await sleep(backoff)
    }
  }
  throw lastErr ?? new Error("anthropic-client: exhausted retries")
}

const ANTHROPIC_TIMEOUT_MS = 120_000 // 2 minutes

async function sendOnce(apiKey: string, req: ModelRequest): Promise<ModelResponse> {
  const body = {
    model: req.model,
    system: req.system,
    temperature: req.temperature,
    max_tokens: req.maxOutputTokens,
    tools: req.tools,
    messages: req.messages,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e: unknown) {
    clearTimeout(timer)
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        `anthropic: request timed out after ${ANTHROPIC_TIMEOUT_MS}ms`,
      )
    }
    throw e
  }
  clearTimeout(timer)
  if (!res.ok) {
    const text = await res.text()
    const err: Error & { status?: number } = new Error(`anthropic: ${res.status} ${res.statusText}: ${text}`)
    err.status = res.status
    throw err
  }
  const json = (await res.json()) as {
    content: ContentBlock[]
    stop_reason: string | null
    usage: { input_tokens: number; output_tokens: number }
  }
  return {
    content: json.content,
    stopReason: json.stop_reason,
    usage: { input: json.usage.input_tokens, output: json.usage.output_tokens },
  }
}

function isRetryable(e: unknown): boolean {
  const status = (e as { status?: number }).status
  if (status === undefined) return true // network errors
  return status === 429 || (status >= 500 && status < 600)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
