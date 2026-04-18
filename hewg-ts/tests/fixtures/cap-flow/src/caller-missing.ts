import { refund } from "./refund.ts"

/**
 * @hewg-module check/caller-missing
 * @effects net.https, fs.write, log
 * @cap fs fs.write prefix="./receipts/"
 * @cap log log
 */
export function callerMissing(
  fs: unknown,
  log: unknown,
): unknown {
  const http: unknown = null
  return refund(http, fs, log, "ch_x", 100)
}
