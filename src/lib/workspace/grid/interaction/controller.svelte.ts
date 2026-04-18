import type { GridConfig } from '../types'
import {
  WORKSPACE_BOTTOM_PADDING,
  WORKSPACE_RIGHT_PADDING,
} from '../const'
import {
  calculateBottomEdgePosition,
  calculateRightEdgePosition,
} from '../sizing'
import {
  createIdleSession,
  isTransformSession,
  mergePreviewPosition,
  startMoveSession,
  startPanSession,
  startResizeSession,
  updateMoveSession,
  updatePanSession,
  updateResizeSession,
  type GridInteractionRect,
  type GridInteractionSession,
  type InteractionPoint,
  type ResizeDirection,
} from './model'
import { GridViewportController } from './viewport'

export class GridInteractionController {
  #session = $state<GridInteractionSession>(createIdleSession())
  #viewport = new GridViewportController()
  #config = $state<GridConfig | null>(null)
  #zoom = $state(1)
  #workspaceGrowthHint = $state<{ width: number | null; height: number | null }>({
    width: null,
    height: null,
  })

  setGridConfig(config: GridConfig): void {
    this.#config = config
  }

  setZoom(zoom: number): void {
    this.#zoom = zoom
  }

  setViewportElement(element: HTMLElement | null): void {
    this.#viewport.setElement(element)
  }

  get mode(): 'idle' | 'panning' | 'moving' | 'resizing' {
    return this.#session.kind
  }

  get isInteracting(): boolean {
    return this.#session.kind !== 'idle'
  }

  get isTransforming(): boolean {
    return isTransformSession(this.#session)
  }

  get isPanning(): boolean {
    return this.#session.kind === 'panning'
  }

  get activeItemId(): number | null {
    return isTransformSession(this.#session) ? this.#session.itemId : null
  }

  get previewRect(): GridInteractionRect | null {
    if (isTransformSession(this.#session)) return this.#session.preview
    return null
  }

  get workspaceWidthHint(): number | null {
    return this.#workspaceGrowthHint.width
  }

  get workspaceHeightHint(): number | null {
    return this.#workspaceGrowthHint.height
  }

  isGhostedItem(itemId: number): boolean {
    return this.activeItemId === itemId && this.isTransforming
  }

  beginMove(item: GridInteractionRect, point: InteractionPoint): void {
    if (!this.#config) return
    this.#viewport.stopAutoScroll()
    this.#session = startMoveSession(
      item,
      point,
      this.#viewport.getScrollOffset()
    )
    this.#syncWorkspaceGrowthHint(point)
  }

  updateMove(point: InteractionPoint): void {
    if (this.#session.kind !== 'moving' || !this.#config) return
    this.#session = updateMoveSession(
      this.#session,
      point,
      this.#viewport.getScrollOffset(),
      this.#config,
      this.#zoom
    )
    this.#viewport.updateAutoScroll(point, () => this.#refreshTransformSession())
    this.#syncWorkspaceGrowthHint(point)
  }

  finishMove(): GridInteractionRect | null {
    if (this.#session.kind !== 'moving') return null
    const preview = this.#session.preview
    this.cancel()
    return preview
  }

  beginResize(
    item: GridInteractionRect,
    min: { w: number; h: number },
    point: InteractionPoint,
    direction: ResizeDirection = 'br'
  ): void {
    if (!this.#config) return
    this.#viewport.stopAutoScroll()
    this.#session = startResizeSession(
      item,
      min,
      point,
      this.#viewport.getScrollOffset(),
      direction
    )
    this.#syncWorkspaceGrowthHint(point)
  }

  updateResize(point: InteractionPoint): void {
    if (this.#session.kind !== 'resizing' || !this.#config) return
    this.#session = updateResizeSession(
      this.#session,
      point,
      this.#viewport.getScrollOffset(),
      this.#config,
      this.#zoom
    )
    this.#viewport.updateAutoScroll(point, () => this.#refreshTransformSession())
    this.#syncWorkspaceGrowthHint(point)
  }

  finishResize(): GridInteractionRect | null {
    if (this.#session.kind !== 'resizing') return null
    const preview = this.#session.preview
    this.cancel()
    return preview
  }

  beginPan(point: InteractionPoint): void {
    this.#viewport.stopAutoScroll()
    this.#workspaceGrowthHint = { width: null, height: null }
    this.#session = startPanSession(point, this.#viewport.getScrollOffset())
  }

  updatePan(point: InteractionPoint): void {
    if (this.#session.kind !== 'panning') return

    const prevPoint = this.#session.pointerCurrent
    // Divide by zoom so 1 px of pointer movement produces 1 px of scroll
    // in the *unscaled* coordinate space (consistent pan speed at any zoom).
    this.#viewport.panBy(
      (point.x - prevPoint.x) / this.#zoom,
      (point.y - prevPoint.y) / this.#zoom
    )
    this.#session = updatePanSession(this.#session, point)
  }

  endPan(): void {
    if (this.#session.kind !== 'panning') return
    this.#workspaceGrowthHint = { width: null, height: null }
    this.#session = createIdleSession()
  }

  cancel(): void {
    this.#viewport.stopAutoScroll()
    this.#workspaceGrowthHint = { width: null, height: null }
    this.#session = createIdleSession()
  }

  destroy(): void {
    this.cancel()
    this.#viewport.destroy()
  }

  getPositionsWithPreview<T extends { id: number; x: number; y: number; w: number; h: number }>(
    positions: T[]
  ): T[] {
    return mergePreviewPosition(positions, this.previewRect) as T[]
  }

  #refreshTransformSession(): void {
    if (!this.#config) return

    if (this.#session.kind === 'moving') {
      this.#session = updateMoveSession(
        this.#session,
        this.#session.pointerCurrent,
        this.#viewport.getScrollOffset(),
        this.#config,
        this.#zoom
      )
      this.#syncWorkspaceGrowthHint(this.#session.pointerCurrent)
      return
    }

    if (this.#session.kind === 'resizing') {
      this.#session = updateResizeSession(
        this.#session,
        this.#session.pointerCurrent,
        this.#viewport.getScrollOffset(),
        this.#config,
        this.#zoom
      )
      this.#syncWorkspaceGrowthHint(this.#session.pointerCurrent)
    }
  }

  #syncWorkspaceGrowthHint(point: InteractionPoint): void {
    if (!this.#config) {
      this.#workspaceGrowthHint = { width: null, height: null }
      return
    }
    if (!isTransformSession(this.#session)) {
      this.#workspaceGrowthHint = { width: null, height: null }
      return
    }

    if (typeof window === 'undefined') {
      this.#workspaceGrowthHint = { width: null, height: null }
      return
    }

    const edgeThreshold = 25
    const expandByCells = 5
    const preview = this.#session.preview
    const cellWidth = this.#config.cellSize.width + this.#config.gap
    const cellHeight = this.#config.cellSize.height + this.#config.gap
    const nextWidthCandidate =
      point.x >= window.innerWidth - edgeThreshold
        ? calculateRightEdgePosition(preview.x, preview.w, this.#config) +
          WORKSPACE_RIGHT_PADDING +
          expandByCells * cellWidth
        : null
    const nextHeightCandidate =
      point.y >= window.innerHeight - edgeThreshold
        ? calculateBottomEdgePosition(preview.y, preview.h, this.#config) +
          WORKSPACE_BOTTOM_PADDING +
          expandByCells * cellHeight
        : null

    this.#workspaceGrowthHint = {
      // Keep the largest expanded size for the whole interaction session.
      // Shrinking mid-drag causes scroll clamping, which feeds back into
      // delta calculations and makes previews jump.
      width:
        nextWidthCandidate === null
          ? this.#workspaceGrowthHint.width
          : Math.max(this.#workspaceGrowthHint.width ?? 0, nextWidthCandidate),
      height:
        nextHeightCandidate === null
          ? this.#workspaceGrowthHint.height
          : Math.max(
              this.#workspaceGrowthHint.height ?? 0,
              nextHeightCandidate
            ),
    }
  }
}
