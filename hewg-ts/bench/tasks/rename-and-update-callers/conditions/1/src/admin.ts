
import { getUser } from "./user.ts"

export function adminGreeting(userId: string): string {
  const user = getUser(userId)
  if (!user) return "Welcome, unknown user"
  return `Welcome back, ${user.name}`
}
