/**
 * @hewg-module csv/csv
 */

import type { Row } from "./types.ts"

/**
 * Parse a CSV string into an array of rows.
 *
 * Supports:
 * - Quoted fields (fields wrapped in double quotes)
 * - Escaped quotes (doubled quote "" inside a quoted field)
 * - Newlines inside quoted fields
 * - Empty fields
 *
 * Current implementation uses string splitting and manual index tracking.
 * This is fragile and hard to maintain.
 *
 * @param input - the raw CSV string
 * @returns array of parsed rows
 * @effects
 */
export function parseCSV(input: string): Row[] {
  const rows: Row[] = []
  let currentRow: string[] = []
  let currentField = ""
  let i = 0

  while (i < input.length) {
    const char = input[i]!

    if (char === '"') {
      // Start of quoted field
      i++ // skip opening quote
      while (i < input.length) {
        if (input[i] === '"') {
          if (i + 1 < input.length && input[i + 1] === '"') {
            // Escaped quote
            currentField += '"'
            i += 2
          } else {
            // End of quoted field
            i++ // skip closing quote
            break
          }
        } else {
          currentField += input[i]
          i++
        }
      }
    } else if (char === ",") {
      currentRow.push(currentField)
      currentField = ""
      i++
    } else if (char === "\n") {
      currentRow.push(currentField)
      currentField = ""
      rows.push(currentRow)
      currentRow = []
      i++
    } else if (char === "\r") {
      // Handle \r\n
      i++
      if (i < input.length && input[i] === "\n") i++
      currentRow.push(currentField)
      currentField = ""
      rows.push(currentRow)
      currentRow = []
    } else {
      currentField += char
      i++
    }
  }

  // Don't forget the last field/row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows
}
