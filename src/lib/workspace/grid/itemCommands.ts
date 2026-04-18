import type { WorkspaceService } from '$lib/workspace/service.svelte'
import type { AllGridTypes } from '$lib/workspace'
import type { GridConfig } from './types'

type WorkspaceGridCommands = Pick<
  WorkspaceService,
  'duplicateVisualization' | 'removeVisualization' | 'updateItemLayout'
>

type GridItemIdentity = Pick<AllGridTypes, 'id' | 'type'>
type GridItemMinimum = Pick<AllGridTypes, 'min'>

export type GridMoveCommit = { id: number; x: number; y: number }
export type GridResizeCommit = {
  id: number
  x: number
  y: number
  w: number
  h: number
}
export type GridIdentityCommit = { id: number }
export type GridDuplicationCommit = {
  id: number
  duplicateId?: number
  position?: { x: number; y: number }
}

function findGridItem(
  items: AllGridTypes[],
  itemId: number
): AllGridTypes | undefined {
  return items.find(item => item.id === itemId)
}

export function getGridItemCommandSource(item: GridItemIdentity): string {
  return `${item.type}.${item.id}.workspace`
}

export function getGridItemMinimumSize(
  item: GridItemMinimum,
  gridConfig: GridConfig
): { w: number; h: number } {
  return {
    w: Math.max(gridConfig.minWidth, item.min?.w ?? gridConfig.minWidth),
    h: Math.max(gridConfig.minHeight, item.min?.h ?? gridConfig.minHeight),
  }
}

export function commitGridItemMove(
  workspace: WorkspaceGridCommands,
  items: AllGridTypes[],
  commit: GridMoveCommit
): boolean {
  const item = findGridItem(items, commit.id)
  if (!item) return false

  return workspace.updateItemLayout(
    item.id,
    { x: commit.x, y: commit.y },
    getGridItemCommandSource(item)
  )
}

export function commitGridItemResize(
  workspace: WorkspaceGridCommands,
  items: AllGridTypes[],
  gridConfig: GridConfig,
  commit: GridResizeCommit
): boolean {
  const item = findGridItem(items, commit.id)
  if (!item) return false

  const min = getGridItemMinimumSize(item, gridConfig)

  // Resizing from a TL/TR/BL corner anchors the opposite edge and moves
  // x/y as the opposite dimension shrinks. Persist the new position along
  // with the new size; committing only w/h would leave the item anchored
  // to its original top-left on the grid.
  return workspace.updateItemLayout(
    item.id,
    {
      x: Math.max(0, commit.x),
      y: Math.max(0, commit.y),
      w: Math.max(min.w, commit.w),
      h: Math.max(min.h, commit.h),
    },
    getGridItemCommandSource(item)
  )
}

export function commitGridItemRemoval(
  workspace: WorkspaceGridCommands,
  items: AllGridTypes[],
  commit: GridIdentityCommit
): boolean {
  const item = findGridItem(items, commit.id)
  if (!item) return false

  return workspace.removeVisualization(item.id, getGridItemCommandSource(item))
}

export function commitGridItemDuplication(
  workspace: WorkspaceGridCommands,
  items: AllGridTypes[],
  commit: GridDuplicationCommit
): boolean {
  const item = findGridItem(items, commit.id)
  if (!item) return false

  return workspace.duplicateVisualization(
    item.id,
    getGridItemCommandSource(item),
    { duplicateId: commit.duplicateId, position: commit.position }
  )
}
