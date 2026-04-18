/**
 * @hewg-magic unused
 * @effects    net.https fs.write
 * @cap htpp net.https host="api.stripe.com"
 * @cap fs   fs.write  prefix="./receipts/"
 * @cap log  log
 * @pre  amountCents > 0 && tokens > zero
 * @post result.ok => exists
 * @cost tokenz=120 ops=~6
 */
export function refund(http: unknown, amountCents: number): unknown {
  void http
  void amountCents
  return null
}
