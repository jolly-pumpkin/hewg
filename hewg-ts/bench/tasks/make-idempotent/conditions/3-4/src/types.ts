/**
 * @hewg-module idempotent/types
 */

export type Order = {
  id: string
  customerId: string
  items: Array<{ sku: string; qty: number }>
  totalCents: number
}

export type Receipt = {
  orderId: string
  processedAt: string
}
