
import type { Result } from "./result.ts"
import { ok, notFound } from "./result.ts"
import type { User, UserId } from "./types.ts"

const users: User[] = [
  { id: "u1", name: "Alice", email: "alice@example.com" },
  { id: "u2", name: "Bob", email: "bob@example.com" },
]

/**
 * Look up a user by ID.
 * @param id - user identifier
 * @returns Result containing the User or a not-found error
 */
export function getUser(id: UserId): Result<User> {
  const user = users.find((u) => u.id === id)
  if (!user) return notFound(`user ${id} not found`)
  return ok(user)
}
