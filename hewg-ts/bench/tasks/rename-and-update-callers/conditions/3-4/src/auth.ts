/**
 * @hewg-module rename/auth
 */

import { getUser } from "./user.ts"

/**
 * Check if a user ID belongs to an admin.
 * @param userId - the user to check
 * @returns true if the user is an admin
 * @effects
 */
export function isAdmin(userId: string): boolean {
  const user = getUser(userId)
  return user?.role === "admin"
}
