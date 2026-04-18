import { refund } from "./refund.ts"

/**
 * @hewg-module check/caller-wrongname
 * @effects net.https, fs.write, log
 * @cap client net.https host="api.stripe.com" port=443
 * @cap fs fs.write prefix="./receipts/"
 * @cap log log
 */
export function callerWrongName(
  client: unknown,
  fs: unknown,
  log: unknown,
): unknown {
  return refund(client, fs, log, "ch_x", 100)
}
