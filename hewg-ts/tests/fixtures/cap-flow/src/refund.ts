/**
 * @hewg-module payments/refund
 * @effects net.https, fs.write, log
 * @cap http net.https host="api.stripe.com" port=443
 * @cap fs fs.write prefix="./receipts/"
 * @cap log log
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
