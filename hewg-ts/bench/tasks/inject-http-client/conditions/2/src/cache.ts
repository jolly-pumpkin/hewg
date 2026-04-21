
import type { Price } from "./types.ts"

const store = new Map<string, Price>()

/**
 * Get a cached price by product ID.
 * @param productId - the product identifier
 */
export function getCached(productId: string): Price | undefined {
  return store.get(productId)
}

/**
 * Store a price in the cache.
 * @param price - the price to cache
 */
export function setCache(price: Price): void {
  store.set(price.productId, price)
}
