export type GroupedByDisplayedName<T> = T & { memberIds: number[] }

/**
 * The minimal shape `groupByDisplayedName` needs: a stable numeric id and the
 * displayed name it groups by. Every interpreted entity satisfies it —
 * `ExtendedInterpretedDataType` (AOIs, categories, event channels; carries
 * `color`) AND `BaseInterpretedDataType` (stimuli, participants; no `color`).
 * The rule only reads these two fields, so it is deliberately structural rather
 * than bound to one branch of the type hierarchy.
 */
export type GroupableByDisplayedName = { id: number; displayedName: string }

/**
 * Groups interpreted entities by their trimmed displayed name, preserving
 * first-occurrence order. Each group keeps the first member's identity/
 * appearance and collects every merged member's id in `memberIds`. Entities
 * with an empty displayed name stay standalone.
 *
 * This is the single definition of the "merge by displayed name" rule. It
 * backs the scarf plot and the data exporters (AOIs / categories / event
 * channels), and — since the bound is structural — the stimulus/participant
 * merge feature reuses the exact same rule on `BaseInterpretedDataType`, so
 * "same displayed name = same entity" stays consistent across every axis.
 */
export function groupByDisplayedName<T extends GroupableByDisplayedName>(
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
