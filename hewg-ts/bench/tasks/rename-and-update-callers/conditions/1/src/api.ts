
import { getUser } from "./user.ts"
import type { User } from "./types.ts"

export function handleGetProfile(userId: string): string {
  const user = getUser(userId)
  if (!user) return JSON.stringify({ error: "not found" })
  return JSON.stringify({ id: user.id, name: user.name, email: user.email })
}
