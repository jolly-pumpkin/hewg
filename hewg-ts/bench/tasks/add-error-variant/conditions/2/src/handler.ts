
import { getUser } from "./user-service.ts"
import { getOrder } from "./order-service.ts"
import type { UserId, OrderId } from "./types.ts"

/**
 * Handle a request to fetch a user and their latest order.
 * @param userId - the user to look up
 * @param orderId - the order to look up
 * @returns a formatted response string
 */
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
