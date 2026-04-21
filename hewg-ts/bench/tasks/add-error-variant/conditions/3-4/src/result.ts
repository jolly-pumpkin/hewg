/**
 * @hewg-module errors/result
 */

/**
 * A discriminated union for operation outcomes.
 * @effects
 */
export type Result<T> =
  | { kind: "ok"; value: T }
  | { kind: "not_found"; message: string }

/**
 * @effects
 */
export function ok<T>(value: T): Result<T> {
  return { kind: "ok", value }
}

/**
 * @effects
 */
export function notFound(message: string): Result<never> {
  return { kind: "not_found", message }
}
