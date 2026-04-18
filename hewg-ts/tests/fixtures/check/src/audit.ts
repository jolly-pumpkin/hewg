import * as fs from "fs"

/**
 * @effects log
 * @cap log log
 */
export async function audit(path: string): Promise<unknown> {
   const data = await fs.readFile(path, () => {}); return data;
}
