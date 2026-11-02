/**
 * Returns a new array with `item` toggled: removed if present, appended if absent.
 */
export function toggleInArray<T>(array: T[], item: T): T[] {
  return array.includes(item)
    ? array.filter(v => v !== item)
    : [...array, item]
}
