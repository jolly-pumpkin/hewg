
import type { Price } from "./types.ts"

const store = new Map<string, Price>()

export function getCached(productId: string): Price | undefined {
  return store.get(productId)
}

export function setCache(price: Price): void {
  store.set(price.productId, price)
}
