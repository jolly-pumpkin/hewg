
import type { User } from "./types.ts"

const users: User[] = [
  { id: "u1", name: "Alice", email: "alice@co.com", role: "admin" },
  { id: "u2", name: "Bob", email: "bob@co.com", role: "member" },
  { id: "u3", name: "Carol", email: "carol@co.com", role: "guest" },
]

/**
 * Look up a user by their unique identifier.
 * @param id - the user ID to search for
 * @returns the User or undefined if not found
 */
export function getUser(id: string): User | undefined {
  return users.find((u) => u.id === id)
}
