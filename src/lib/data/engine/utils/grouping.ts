import type { ExtendedInterpretedDataType } from '$lib/data/types'

export type GroupedByDisplayedName<T> = T & { memberIds: number[] }

/**
 * Groups interpreted entities (AOIs, categories, event channels) by their
 * trimmed displayed name, preserving first-occurrence order. Each group keeps
 * the first member's identity/appearance and collects every merged member's id
 * in `memberIds`. Entities with an empty displayed name stay standalone.
 *
 * This is the single definition of the "merge by displayed name" rule that the
 * scarf plot and the data exporters both rely on, so renamed/grouped output is
 * consistent across visualization and export.
 */
export function groupByDisplayedName<T extends ExtendedInterpretedDataType>(
  items: T[]
): GroupedByDisplayedName<T>[] {
  if (items.length === 0) return []

  const grouped: GroupedByDisplayedName<T>[] = []
  const processed = new Set<number>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (processed.has(item.id)) continue

    const trimmedName = (item.displayedName || '').trim()
    const memberIds = [item.id]
    processed.add(item.id)

    if (trimmedName.length > 0) {
      for (let j = i + 1; j < items.length; j++) {
        const candidate = items[j]
        if (processed.has(candidate.id)) continue
        if ((candidate.displayedName || '').trim() === trimmedName) {
          memberIds.push(candidate.id)
          processed.add(candidate.id)
        }
      }
    }

    grouped.push({ ...item, memberIds })
  }

  return grouped
}
