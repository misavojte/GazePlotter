import { isMenuDivider, type MenuItem } from './types'

/**
 * The items a menu search keeps: those whose label, detail and keywords
 * contain every typed word (any order, case-insensitive). A section heading
 * (a labelled divider) stays while its section has a match; plain dividers
 * drop, since the filtered list has no groups left to separate.
 */
export function filterMenuItems(items: MenuItem[], query: string): MenuItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return items
  const kept: MenuItem[] = []
  let heading: MenuItem | null = null
  for (const item of items) {
    if (isMenuDivider(item)) {
      heading = item.label ? item : null
      continue
    }
    const text = `${item.label ?? ''} ${item.detail ?? ''} ${item.keywords ?? ''}`.toLowerCase()
    if (!words.every(word => text.includes(word))) continue
    if (heading) kept.push(heading)
    heading = null
    kept.push(item)
  }
  return kept
}
