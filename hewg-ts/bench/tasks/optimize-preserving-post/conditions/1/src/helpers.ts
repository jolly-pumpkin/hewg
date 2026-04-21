
export function isSorted(arr: number[]): boolean {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i]! < arr[i - 1]!) return false
  }
  return true
}

export function hasDuplicates(arr: number[]): boolean {
  return new Set(arr).size !== arr.length
}
