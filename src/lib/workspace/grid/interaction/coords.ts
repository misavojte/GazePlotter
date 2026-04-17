import type { GridConfig } from '../types'

// Horizontal/vertical inset from workspace-container's border to the
// grid's 0,0 cell. Kept in sync with `.workspace-container { padding:
// 35px }` in Workspace.svelte.
const WORKSPACE_CONTAINER_PADDING_PX = 35

/**
 * Map a viewport-space pointer coordinate to a grid cell index.
 *
 * Pipeline: subtract workspaceContainer's bounding-box origin → add
 * container scroll → strip the 35px padding → divide by zoom (the grid
 * renders inside a scaled zoom-surface) → divide by the cell+gap unit.
 * Rounded toward the nearest cell so placement reads as hover-snap
 * rather than strictly left-biased.
 */
export function pointerToGridPoint(
  clientX: number,
  clientY: number,
  workspaceContainer: HTMLElement,
  gridConfig: GridConfig,
  zoom: number
): { x: number; y: number } {
  const rect = workspaceContainer.getBoundingClientRect()
  const xInContent =
    clientX - rect.left + workspaceContainer.scrollLeft -
    WORKSPACE_CONTAINER_PADDING_PX
  const yInContent =
    clientY - rect.top + workspaceContainer.scrollTop -
    WORKSPACE_CONTAINER_PADDING_PX
  const unscaledX = xInContent / zoom
  const unscaledY = yInContent / zoom
  const cellW = gridConfig.cellSize.width + gridConfig.gap
  const cellH = gridConfig.cellSize.height + gridConfig.gap
  return {
    x: Math.max(0, Math.round(unscaledX / cellW)),
    y: Math.max(0, Math.round(unscaledY / cellH)),
  }
}

export function isPointerInWorkspace(
  clientX: number,
  clientY: number,
  workspaceContainer: HTMLElement
): boolean {
  const rect = workspaceContainer.getBoundingClientRect()
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  )
}
