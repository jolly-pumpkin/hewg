
/**
 * Check if an array of numbers is sorted in ascending order.
 * @param arr - the array to check
 * @returns true if sorted ascending
 */
export function isSorted(arr: number[]): boolean {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i]! < arr[i - 1]!) return false
  }
  return true
}

/**
 * Check if an array contains duplicate values.
 * @param arr - the array to check
 * @returns true if there are duplicates
 */
export function hasDuplicates(arr: number[]): boolean {
  return new Set(arr).size !== arr.length
}
