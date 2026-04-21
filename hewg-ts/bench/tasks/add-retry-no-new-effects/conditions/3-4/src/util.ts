/**
 * @hewg-module retry/util
 */

/**
 * Sleep for the given number of milliseconds.
 * @param ms - milliseconds to wait
 * @effects time.sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Log a message with a timestamp prefix.
 * @param msg - message to log
 * @effects log
 */
export function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}
