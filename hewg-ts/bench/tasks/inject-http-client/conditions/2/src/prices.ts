
import type { Price, PriceUpdate } from "./types.ts"
import { setCache } from "./cache.ts"

/**
 * Sync latest prices from the remote pricing API and update the local cache.
 * @param productIds - product IDs to sync
 * @returns the updated prices
 */
export async function syncPrices(productIds: string[]): Promise<Price[]> {
  const res = await fetch(
    `https://api.prices.example.com/v1/prices?ids=${productIds.join(",")}`,
  )
  if (!res.ok) {
    throw new Error(`Price API returned ${res.status}`)
  }
  const updates: PriceUpdate[] = (await res.json()) as PriceUpdate[]
  const now = new Date().toISOString()
  const prices: Price[] = updates.map((u) => ({
    productId: u.productId,
    amount: u.amount,
    currency: u.currency,
    updatedAt: now,
  }))
  for (const p of prices) {
    setCache(p)
  }
  return prices
}
