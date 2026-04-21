
import type { User } from "./types.ts"
import { ApiError } from "./types.ts"

export async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`https://api.example.com/users/${id}`)
  if (!res.ok) {
    throw new ApiError(res.status, `Failed to fetch user ${id}`)
  }
  return (await res.json()) as User
}
