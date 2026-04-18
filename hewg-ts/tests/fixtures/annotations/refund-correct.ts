/**
 * @hewg-module payments/refund
 * @effects net.https, fs.write, log
 * @cap http net.https host="api.stripe.com" port=443
 * @cap fs fs.write prefix="./receipts/"
 * @cap log log
 * @pre amountCents > 0
 * @post !result.ok || exists_receipt_file(result.val.id)
 * @cost tokens=120 ops=~6 net<=3 time<=5s
 */
export function refund(
  http: unknown,
  fs: unknown,
  log: unknown,
  chargeId: string,
  amountCents: number,
): unknown {
  void http
  void fs
  void log
  void chargeId
  void amountCents
  return null
}
