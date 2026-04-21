/**
 * @hewg-module deploy/hash
 */

/**
 * Compute a simple hash of a string (djb2 algorithm).
 * @param input - the string to hash
 * @returns hex string hash
 * @effects
 */
export function hashString(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}
