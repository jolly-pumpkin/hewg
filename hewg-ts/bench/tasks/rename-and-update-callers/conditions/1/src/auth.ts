
import { getUser } from "./user.ts"

export function isAdmin(userId: string): boolean {
  const user = getUser(userId)
  return user?.role === "admin"
}
