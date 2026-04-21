
import type { Result } from "./result.ts"
import { ok, notFound } from "./result.ts"
import type { Order, OrderId } from "./types.ts"

const orders: Order[] = [
  { id: "o1", userId: "u1", total: 42.0, status: "pending" },
  { id: "o2", userId: "u2", total: 99.5, status: "shipped" },
]

export function getOrder(id: OrderId): Result<Order> {
  const order = orders.find((o) => o.id === id)
  if (!order) return notFound(`order ${id} not found`)
  return ok(order)
}
