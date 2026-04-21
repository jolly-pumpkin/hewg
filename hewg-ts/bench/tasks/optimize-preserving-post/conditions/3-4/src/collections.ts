/**
 * @hewg-module collections/collections
 */

/**
 * Sort an array of numbers and remove duplicates.
 *
 * Current implementation: sort, then filter duplicates in a second pass.
 *
 * @param input - the array to process
 * @returns a new sorted array with no duplicates
 * @effects
 * @pre input.length >= 0
 * @post result.length <= input.length
 * @post isSorted(result)
 * @post !hasDuplicates(result)
 */
export function sortAndDeduplicate(input: number[]): number[] {
  // Step 1: sort
  const sorted = [...input].sort((a, b) => a - b)

  // Step 2: remove duplicates (separate pass)
  const result = sorted.filter((val, idx) => idx === 0 || val !== sorted[idx - 1])

  return result
}
