declare const externalThing: () => void

/**
 * @hewg-module check/unknown
 * @effects log
 */
export function foo(): void {
  externalThing()
  console.log("u")
}
