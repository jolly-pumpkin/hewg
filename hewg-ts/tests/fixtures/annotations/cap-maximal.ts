/**
 * @cap http net.https host="api.stripe.com" port=443 path_prefix="/v1"
 * @cap fs fs.write prefix="./receipts/"
 * @cap log log
 */
export function target(http: unknown, fs: unknown, log: unknown) {
  void http
  void fs
  void log
}
