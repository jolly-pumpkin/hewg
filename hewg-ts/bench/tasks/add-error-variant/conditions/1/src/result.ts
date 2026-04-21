
export type Result<T> =
  | { kind: "ok"; value: T }
  | { kind: "not_found"; message: string }

export function ok<T>(value: T): Result<T> {
  return { kind: "ok", value }
}

export function notFound(message: string): Result<never> {
  return { kind: "not_found", message }
}
