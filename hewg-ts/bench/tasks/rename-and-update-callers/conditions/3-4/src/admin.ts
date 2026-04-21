/**
 * @hewg-module rename/admin
 */

import { getUser } from "./user.ts"

/**
 * Get the display name for an admin panel header.
 * @param userId - the logged-in user ID
 * @returns greeting string
 * @effects
 */
export function adminGreeting(userId: string): string {
  const user = getUser(userId)
  if (!user) return "Welcome, unknown user"
  return `Welcome back, ${user.name}`
}
