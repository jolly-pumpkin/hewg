/**
 * @hewg-module errors/types
 */

export type UserId = string
export type OrderId = string

export type User = {
  id: UserId
  name: string
  email: string
}

export type Order = {
  id: OrderId
  userId: UserId
  total: number
  status: "pending" | "shipped" | "delivered"
}
