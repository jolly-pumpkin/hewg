/**
 * @hewg-module rename/types
 */

export type User = {
  id: string
  name: string
  email: string
  role: "admin" | "member" | "guest"
}
