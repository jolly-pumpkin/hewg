import { refund } from "./refund.ts"

/**
 * @hewg-module check/caller-ok
 * @effects net.https, fs.write, log
 * @cap http net.https host="api.stripe.com" port=443
 * @cap fs fs.write prefix="./receipts/"
 * @cap log log
 */
export function callerOk(
  http: unknown,
  fs: unknown,
  log: unknown,
): unknown {
  return refund(http, fs, log, "ch_x", 100)
}
