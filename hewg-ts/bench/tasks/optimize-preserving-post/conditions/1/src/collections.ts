
export function sortAndDeduplicate(input: number[]): number[] {
  // Step 1: sort
  const sorted = [...input].sort((a, b) => a - b)

  // Step 2: remove duplicates (separate pass)
  const result = sorted.filter((val, idx) => idx === 0 || val !== sorted[idx - 1])

  return result
}
