import * as fs from "fs"

/**
 * @hewg-module check/helper
 * @effects fs.read
 */
export async function helper(path: string): Promise<unknown> {
  return fs.readFile(path, () => {})
}
