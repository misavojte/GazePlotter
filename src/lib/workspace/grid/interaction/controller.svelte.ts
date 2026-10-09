import type { GridConfig } from '../types'
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
import { GridViewportController, type InteractionCamera } from './viewport'

export class GridInteractionController {
  #session = $state<GridInteractionSession>(createIdleSession())
  #viewport = new GridViewportController()
  #config = $state<GridConfig | null>(null)
  #zoom = $state(1)

  setGridConfig(config: GridConfig): void {
    this.#config = config
  }

  setZoom(zoom: number): void {
    this.#zoom = zoom
  }

  setViewportElement(element: HTMLElement | null): void {
    this.#viewport.setElement(element)
  }

  setCamera(camera: InteractionCamera | null): void {
    this.#viewport.setCamera(camera)
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

  get activeItemIds(): number[] {
    if (this.#session.kind === 'moving')
      return this.#session.members.map(m => m.id)
    if (this.#session.kind === 'resizing') return [this.#session.itemId]
    return []
  }

  get activeItemId(): number | null {
    if (this.#session.kind === 'resizing') return this.#session.itemId
    if (this.#session.kind === 'moving')
      return this.#session.members[0]?.id ?? null
    return null
  }

  get previewRects(): GridInteractionRect[] {
    if (this.#session.kind === 'moving')
      return this.#session.members.map(m => m.preview)
    if (this.#session.kind === 'resizing') return [this.#session.preview]
    return []
  }

  isGhostedItem(itemId: number): boolean {
    return this.isTransforming && this.activeItemIds.includes(itemId)
  }

  beginMove(items: GridInteractionRect[], point: InteractionPoint): void {
    if (!this.#config || items.length === 0) return
    this.#viewport.stopAutoScroll()
    this.#session = startMoveSession(
      items,
      point,
      this.#viewport.getScrollOffset()
    )
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
  }

  finishMove(): GridInteractionRect[] | null {
    if (this.#session.kind !== 'moving') return null
    const previews = this.#session.members.map(m => m.preview)
    this.cancel()
    return previews
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
  }

  finishResize(): GridInteractionRect | null {
    if (this.#session.kind !== 'resizing') return null
    const preview = this.#session.preview
    this.cancel()
    return preview
  }

  beginPan(point: InteractionPoint): void {
    this.#viewport.stopAutoScroll()
    this.#session = startPanSession(point, this.#viewport.getScrollOffset())
  }

  updatePan(point: InteractionPoint): void {
    if (this.#session.kind !== 'panning') return

    // Measured from where the drag began, not summed per move, so the grabbed
    // point stays under the cursor (the offset is in screen px at any zoom).
    const { pointerStart, scrollStart } = this.#session
    this.#viewport.scrollTo({
      x: scrollStart.x - (point.x - pointerStart.x),
      y: scrollStart.y - (point.y - pointerStart.y),
    })
    this.#session = updatePanSession(this.#session, point)
  }

  endPan(): void {
    if (this.#session.kind !== 'panning') return
    this.#session = createIdleSession()
  }

  cancel(): void {
    this.#viewport.stopAutoScroll()
    this.#session = createIdleSession()
  }

  destroy(): void {
    this.cancel()
    this.#viewport.destroy()
  }

  getPositionsWithPreview<T extends { id: number; x: number; y: number; w: number; h: number }>(
    positions: T[]
  ): T[] {
    return mergePreviewPosition(positions, this.previewRects) as T[]
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
    }
  }
}
