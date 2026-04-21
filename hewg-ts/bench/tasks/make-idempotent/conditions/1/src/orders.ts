
import type { Order, Receipt } from "./types.ts"
import { saveReceipt } from "./db.ts"
import { notifyFulfillment } from "./notify.ts"

export async function processOrder(order: Order): Promise<Receipt> {
  const receipt: Receipt = {
    orderId: order.id,
    processedAt: new Date().toISOString(),
  }
  saveReceipt(receipt)
  await notifyFulfillment(order.id)
  return receipt
}
