import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

/**
 * @hewg-module bench/lib/workspace
 * @effects fs.read, fs.write
 */
export function prepareWorkspace(src: string, dest: string): void {
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  copyTree(src, dest)
}

/**
 * @hewg-module bench/lib/workspace
 * @effects fs.read
 */
export function snapshotTree(root: string): Map<string, string> {
  const out = new Map<string, string>()
  walk(root, (abs) => {
    const rel = relative(root, abs)
    out.set(rel, readFileSync(abs, "utf8"))
  })
  return out
}

/**
 * @hewg-module bench/lib/workspace
 * @effects fs.read
 */
export function diffTrees(
  before: Map<string, string>,
  afterRoot: string,
): string {
  const after = snapshotTree(afterRoot)
  const paths = new Set<string>([...before.keys(), ...after.keys()])
  const parts: string[] = []
  for (const path of [...paths].sort()) {
    const a = before.get(path)
    const b = after.get(path)
    if (a === b) continue
    if (a === undefined) {
      parts.push(`+++ ${path}\n${b}`)
    } else if (b === undefined) {
      parts.push(`--- ${path}\n${a}`)
    } else {
      parts.push(`*** ${path}\nBEFORE:\n${a}\nAFTER:\n${b}`)
    }
  }
  return parts.join("\n---\n")
}

/**
 * @hewg-module bench/lib/workspace
 * @effects fs.read
 */
export function listFiles(root: string): string[] {
  const out: string[] = []
  walk(root, (abs) => out.push(relative(root, abs)))
  out.sort()
  return out
}

function walk(root: string, visit: (abs: string) => void): void {
  const abs = resolve(root)
  const stack: string[] = [abs]
  while (stack.length > 0) {
    const cur = stack.pop()!
    for (const entry of readdirSync(cur)) {
      const full = join(cur, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        stack.push(full)
      } else if (st.isFile()) {
        visit(full)
      }
    }
  }
}

function copyTree(src: string, dest: string): void {
  walk(src, (abs) => {
    const rel = relative(src, abs)
    const target = join(dest, rel)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(abs, target)
  })
}

/**
 * @hewg-module bench/lib/workspace
 * @effects fs.write
 */
export function writeFileEnsureDir(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents)
}
