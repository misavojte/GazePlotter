import type { WorkspaceService } from '$lib/workspace/service.svelte'
import type { AllGridTypes } from '$lib/workspace/type/gridType'
import type { GridConfig } from './types'

type WorkspaceGridCommands = Pick<
  WorkspaceService,
  'duplicateVisualization' | 'removeVisualization' | 'updateItemLayout'
>

type GridItemIdentity = Pick<AllGridTypes, 'id' | 'type'>
type GridItemMinimum = Pick<AllGridTypes, 'min'>

export type GridMoveCommit = { id: number; x: number; y: number }
export type GridResizeCommit = { id: number; w: number; h: number }
export type GridIdentityCommit = { id: number }

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

  return workspace.updateItemLayout(
    item.id,
    {
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
  commit: GridIdentityCommit
): boolean {
  const item = findGridItem(items, commit.id)
  if (!item) return false

  return workspace.duplicateVisualization(
    item.id,
    getGridItemCommandSource(item)
  )
}
