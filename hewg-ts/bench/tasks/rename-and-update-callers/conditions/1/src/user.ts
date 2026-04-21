
import type { User } from "./types.ts"

const users: User[] = [
  { id: "u1", name: "Alice", email: "alice@co.com", role: "admin" },
  { id: "u2", name: "Bob", email: "bob@co.com", role: "member" },
  { id: "u3", name: "Carol", email: "carol@co.com", role: "guest" },
]

export function getUser(id: string): User | undefined {
  return users.find((u) => u.id === id)
}
