import * as fs from "fs"

/**
 * @hewg-module payments/refund
 * @effects net.https, fs.write, log
 * @cap http net.https host="api.stripe.com" port=443
 * @cap fsw fs.write prefix="./receipts/"
 * @cap log log
 */
export async function refund(
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
