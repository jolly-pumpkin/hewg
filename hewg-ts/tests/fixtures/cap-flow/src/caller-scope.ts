import { refund } from "./refund.ts"

/**
 * @hewg-module check/caller-scope
 * @effects net.https, fs.write, log
 * @cap http net.https host="api.paypal.com" port=443
 * @cap fs fs.write prefix="./receipts/"
 * @cap log log
 */
export function callerScope(
  http: unknown,
  fs: unknown,
  log: unknown,
): unknown {
  return refund(http, fs, log, "ch_x", 100)
}
