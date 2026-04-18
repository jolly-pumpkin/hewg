import * as fs from "fs"

/**
 * @hewg-module payments/refund-broken
 * @effects log
 * @cap log log
 */
export async function refundBroken(
  chargeId: string,
  amountCents: number,
): Promise<unknown> {
  void chargeId
  void amountCents
  await fetch("https://api.stripe.com/refund")
  fs.writeFile("./receipts/r.txt", "ok", () => {})
  console.log("refunded")
  return null
}
