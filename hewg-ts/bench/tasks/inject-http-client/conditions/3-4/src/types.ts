/**
 * @hewg-module pricing/types
 */

export type Price = {
  productId: string
  amount: number
  currency: string
  updatedAt: string
}

export type PriceUpdate = {
  productId: string
  amount: number
  currency: string
}
