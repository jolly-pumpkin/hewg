// Unannotated user function. Callers that consume it must inherit its
// observed effects via the recursive walk.
export function util(): number {
  return Math.random()
}
