
import { getUser } from "./user-service.ts"
import { getOrder } from "./order-service.ts"
import type { UserId, OrderId } from "./types.ts"

export function handleRequest(userId: UserId, orderId: OrderId): string {
  const userResult = getUser(userId)
  switch (userResult.kind) {
    case "ok":
      break
    case "not_found":
      return `Error: ${userResult.message}`
  }

  const orderResult = getOrder(orderId)
  switch (orderResult.kind) {
    case "ok":
      return `User: ${userResult.value.name}, Order #${orderResult.value.id}: $${orderResult.value.total}`
    case "not_found":
      return `Error: ${orderResult.message}`
  }
}
