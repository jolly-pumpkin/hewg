/**
 * @hewg-module rename/api
 */

import { getUser } from "./user.ts"
import type { User } from "./types.ts"

/**
 * API handler: return a user's profile as JSON.
 * @param userId - the user ID from the request
 * @returns JSON string or error message
 * @effects
 */
export function handleGetProfile(userId: string): string {
  const user = getUser(userId)
  if (!user) return JSON.stringify({ error: "not found" })
  return JSON.stringify({ id: user.id, name: user.name, email: user.email })
}
