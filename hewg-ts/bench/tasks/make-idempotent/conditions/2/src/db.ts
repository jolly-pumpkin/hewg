
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import type { Receipt } from "./types.ts"

const RECEIPTS_DIR = "./data"

/**
 * Save a receipt to disk.
 * @param receipt - the receipt to persist
 */
export function saveReceipt(receipt: Receipt): void {
  mkdirSync(RECEIPTS_DIR, { recursive: true })
  const path = `${RECEIPTS_DIR}/${receipt.orderId}.json`
  writeFileSync(path, JSON.stringify(receipt))
}

/**
 * Check if a receipt already exists for an order.
 * @param orderId - the order to check
 */
export function receiptExists(orderId: string): boolean {
  return existsSync(`${RECEIPTS_DIR}/${orderId}.json`)
}

/**
 * Load a receipt from disk.
 * @param orderId - the order whose receipt to load
 */
export function loadReceipt(orderId: string): Receipt | null {
  const path = `${RECEIPTS_DIR}/${orderId}.json`
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf8")) as Receipt
}
