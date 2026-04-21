
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}
