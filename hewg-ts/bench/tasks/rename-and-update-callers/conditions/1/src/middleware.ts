
import { getUser } from "./user.ts"

export function canAccess(userId: string): boolean {
  const user = getUser(userId)
  if (!user) return false
  return user.role !== "guest"
}
