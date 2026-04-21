/**
 * @hewg-module bench/lib/live-log
 *
 * Live log trail for benchmark runs. Prints structured, color-coded output
 * to stderr so the user can watch what the agent is doing in real time.
 *
 * Three actors with distinct visual styles:
 *   Agent  — the model's reasoning (cyan)
 *   Tool   — tool calls (yellow) and results (green/red)
 *   System — harness events like budgets, retries, errors (dim)
 */

const isTTY = process.stderr.isTTY === true

const RESET = isTTY ? "\x1b[0m" : ""
const DIM = isTTY ? "\x1b[2m" : ""
const CYAN = isTTY ? "\x1b[36m" : ""
const YELLOW = isTTY ? "\x1b[33m" : ""
const GREEN = isTTY ? "\x1b[32m" : ""
const RED = isTTY ? "\x1b[31m" : ""
const BOLD = isTTY ? "\x1b[1m" : ""

const BOX_TL = isTTY ? "\u256d" : "+"
const BOX_BL = isTTY ? "\u2570" : "+"
const BOX_H = isTTY ? "\u2500" : "-"

export type LiveLogger = {
  runStart(): void
  iterationStart(iter: number, budget: number): void
  assistantText(iter: number, text: string): void
  toolCall(iter: number, name: string, inputPreview: string): void
  toolResult(iter: number, name: string, isError: boolean, preview: string): void
  system(iter: number, message: string): void
  stop(reason: string, iterations: number, tokens: number): void
}

function write(s: string): void {
  process.stderr.write(s + "\n")
}

function pad(label: string, width: number): string {
  return label.padEnd(width)
}

function truncateText(text: string, max: number): string {
  const oneLine = text.replace(/\n/g, " ").trim()
  if (oneLine.length <= max) return oneLine
  return oneLine.slice(0, max - 3) + "..."
}

export function createLiveLogger(
  taskId: string,
  condition: number,
  seed: number,
  verbose: boolean,
): LiveLogger {
  const LABEL_W = 8
  const TEXT_MAX = verbose ? 500 : 120

  return {
    runStart() {
      const title = ` ${taskId}  cond=${condition}  seed=${seed} `
      const rule = BOX_H.repeat(Math.max(0, 54 - title.length))
      write("")
      write(`${DIM}${BOX_TL}${BOX_H}${RESET}${BOLD}${title}${RESET}${DIM}${rule}${RESET}`)
      write("")
    },

    iterationStart(iter: number, budget: number) {
      write(`  ${DIM}turn ${iter}/${budget}${RESET}`)
    },

    assistantText(iter: number, text: string) {
      if (text === "") return
      const preview = truncateText(text, TEXT_MAX)
      write(`  ${CYAN}${pad("Agent", LABEL_W)}${RESET}${preview}`)
    },

    toolCall(iter: number, name: string, inputPreview: string) {
      const preview = truncateText(inputPreview, TEXT_MAX - name.length - 2)
      write(`  ${YELLOW}${pad("Tool", LABEL_W)}${RESET}${name}  ${DIM}${preview}${RESET}`)
    },

    toolResult(iter: number, name: string, isError: boolean, preview: string) {
      const mark = isError ? `${RED}\u2717 FAIL` : `${GREEN}\u2713`
      const detail = truncateText(preview, TEXT_MAX)
      write(`  ${mark}${RESET} ${pad("Result", LABEL_W)}${name}  ${DIM}${detail}${RESET}`)
    },

    system(iter: number, message: string) {
      write(`  ${DIM}${pad("System", LABEL_W)}${message}${RESET}`)
    },

    stop(reason: string, iterations: number, tokens: number) {
      const tokStr = tokens.toLocaleString()
      const label = reason.toUpperCase()
      const title = ` ${label}  ${iterations} turns  ${tokStr} tokens `
      const rule = BOX_H.repeat(Math.max(0, 54 - title.length))
      write("")
      write(`${DIM}${BOX_BL}${BOX_H}${RESET}${BOLD}${title}${RESET}${DIM}${rule}${RESET}`)
      write("")
    },
  }
}

export function createNoopLogger(): LiveLogger {
  const noop = () => {}
  return {
    runStart: noop,
    iterationStart: noop,
    assistantText: noop,
    toolCall: noop,
    toolResult: noop,
    system: noop,
    stop: noop,
  }
}
