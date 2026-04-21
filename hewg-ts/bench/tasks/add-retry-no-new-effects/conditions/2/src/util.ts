
/**
 * Sleep for the given number of milliseconds.
 * @param ms - milliseconds to wait
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Log a message with a timestamp prefix.
 * @param msg - message to log
 */
export function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}
