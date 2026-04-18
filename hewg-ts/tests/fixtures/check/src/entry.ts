import { helper } from "./helper.ts"
import { util } from "./util.ts"
import { loop } from "./loop.ts"

/**
 * @hewg-module check/entry
 * @effects log
 */
export async function entry(): Promise<void> {
  await helper("/tmp/x")
  util()
  loop()
  console.log("done")
}
