export function naturalSort(a: string, b: string): number {
  const aParts = a.match(/(\d+|\D+)/g) || []
  const bParts = b.match(/(\d+|\D+)/g) || []
  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    if (/^\d+$/.test(aParts[i]) && /^\d+$/.test(bParts[i])) {
      const diff = parseInt(aParts[i], 10) - parseInt(bParts[i], 10)
      if (diff !== 0) return diff
    } else {
      const cmp = aParts[i].localeCompare(bParts[i])
      if (cmp !== 0) return cmp
    }
  }
  return aParts.length - bParts.length
}

export function sortItems<T>(
  items: T[],
  column: string,
  direction: 'asc' | 'desc'
): T[] {
  return [...items].sort((a, b) => {
    const cmp = naturalSort(
      (a as Record<string, string>)[column],
      (b as Record<string, string>)[column]
    )
    return direction === 'asc' ? cmp : -cmp
  })
}

export function reorderItems<T>(
  items: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  const arr = [...items]
  const [removed] = arr.splice(fromIndex, 1)
  arr.splice(toIndex, 0, removed)
  return arr
}
