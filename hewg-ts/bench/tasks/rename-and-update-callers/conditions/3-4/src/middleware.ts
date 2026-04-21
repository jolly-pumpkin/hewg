/**
 * @hewg-module rename/middleware
 */

import { getUser } from "./user.ts"

/**
 * Middleware-style check: verify the user exists and is not a guest.
 * @param userId - the user ID from the session
 * @returns true if access is allowed
 * @effects
 */
export function canAccess(userId: string): boolean {
  const user = getUser(userId)
  if (!user) return false
  return user.role !== "guest"
}
