import { groupByDisplayedName } from '$lib/data/engine/utils/grouping'

export interface PlannedMerge {
  representativeId: number
  memberIds: number[]
}

/**
 * Given the edited entity list (stimuli or participants), find the
 * displayed-name collisions that constitute merges (PLANMERGE.md M2). Uses the
 * single shared grouping rule: same trimmed displayed name = one entity, first
 * in list order is the representative, the rest fold in. Entities with a unique
 * (or empty) displayed name yield no merge. This is the pure trigger the
 * modification modal runs on Apply to decide what to merge.
 */
export function planDisplayedNameMerges(
  items: { id: number; displayedName: string }[]
): PlannedMerge[] {
  return groupByDisplayedName(items)
    .filter(group => group.memberIds.length > 1)
    .map(group => ({
      representativeId: group.memberIds[0],
      memberIds: group.memberIds.slice(1),
    }))
}
