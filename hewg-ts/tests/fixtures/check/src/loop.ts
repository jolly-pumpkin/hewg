// Mutual recursion. Each side declares @effects log. The analyzer must
// terminate (cycle detection) and emit no diagnostics.

/**
 * @hewg-module check/loop
 * @effects log
 */
export function loop(): void {
  partner()
  console.log("loop")
}

/**
 * @hewg-module check/loop
 * @effects log
 */
export function partner(): void {
  loop()
  console.log("partner")
}
