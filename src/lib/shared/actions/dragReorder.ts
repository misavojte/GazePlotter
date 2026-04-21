export interface DragReorderConfig<TId = number> {
  /** Selector for draggable item (e.g. '.aoi-card', '.accordion-item') */
  itemSelector: string
  /** Selector for container holding all items (e.g. '.aoi-grid', '.accordion') */
  containerSelector: string
  /** Called on drag start — modal sets its drag state */
  onDragStart?: (itemId: TId) => void
  /** Called on drag end — modal clears its drag state */
  onDragEnd?: () => void
  /** Called when items should swap — modal performs its own array reorder */
  onReorder: (fromIndex: number, toIndex: number) => void
}

export function createDragReorder<TId = number>(
  config: DragReorderConfig<TId>
): (node: HTMLElement, itemId: TId) => { destroy(): void } {
  return (node: HTMLElement, itemId: TId) => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()

      const item = node.closest(config.itemSelector) as HTMLElement | null
      if (!item) return

      config.onDragStart?.(itemId)

      // Create floating clone
      const rect = item.getBoundingClientRect()
      const clone = item.cloneNode(true) as HTMLElement
      clone.style.cssText = `
        position:fixed; left:${rect.left}px; top:${rect.top}px;
        width:${rect.width}px; z-index:9999; pointer-events:none;
        opacity:0.85; box-shadow:0 4px 16px rgba(0,0,0,0.15); transition:none;
      `
      document.body.appendChild(clone)

      const offsetX = e.clientX - rect.left
      const offsetY = e.clientY - rect.top
      let swapCooldown = false
      const SWAP_COOLDOWN_MS = 150

      const container = item.closest(
        config.containerSelector
      ) as HTMLElement | null
      const scrollContainer = item.closest('.body') as HTMLElement | null

      // Auto-scroll when cursor is outside modal edges — speed builds up over time
      const MIN_SPEED = 1
      const MAX_SPEED = 10
      const RAMP_FRAMES = 30
      let lastClientY = e.clientY
      let scrollRafId: number | null = null
      let scrollFrames = 0

      const autoScrollTick = () => {
        if (!scrollContainer) return
        const r = scrollContainer.getBoundingClientRect()
        let direction = 0

        if (lastClientY < r.top && scrollContainer.scrollTop > 0) {
          direction = -1
        } else if (lastClientY > r.bottom) {
          const maxScroll =
            scrollContainer.scrollHeight - scrollContainer.clientHeight
          if (scrollContainer.scrollTop < maxScroll) direction = 1
        }

        if (direction !== 0) {
          scrollFrames = Math.min(scrollFrames + 1, RAMP_FRAMES)
          const t = scrollFrames / RAMP_FRAMES
          const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * t
          scrollContainer.scrollBy(0, direction * speed)
        } else {
          scrollFrames = 0
        }

        scrollRafId = requestAnimationFrame(autoScrollTick)
      }

      scrollRafId = requestAnimationFrame(autoScrollTick)

      const onPointerMove = (e: PointerEvent) => {
        clone.style.left = `${e.clientX - offsetX}px`
        clone.style.top = `${e.clientY - offsetY}px`
        lastClientY = e.clientY

        if (swapCooldown || !container) return

        const items = container.querySelectorAll(config.itemSelector)
        const midpoints = Array.from(items).map(el => {
          const r = el.getBoundingClientRect()
          return r.top + r.height / 2
        })

        // Find the dragged item's current DOM index
        const itemsArray = Array.from(items)
        const fromIndex = itemsArray.indexOf(item)
        if (fromIndex === -1) return

        const cursorY = e.clientY
        let targetIndex = midpoints.length
        for (let i = 0; i < midpoints.length; i++) {
          if (cursorY < midpoints[i]) {
            targetIndex = i
            break
          }
        }

        // Dead zone — cursor within the dragged item's own range
        if (targetIndex === fromIndex || targetIndex === fromIndex + 1) return

        // Adjust for removal offset
        const insertIndex =
          targetIndex > fromIndex ? targetIndex - 1 : targetIndex

        config.onReorder(fromIndex, insertIndex)

        swapCooldown = true
        setTimeout(() => {
          swapCooldown = false
        }, SWAP_COOLDOWN_MS)
      }

      const onPointerUp = () => {
        if (scrollRafId !== null) {
          cancelAnimationFrame(scrollRafId)
          scrollRafId = null
        }
        config.onDragEnd?.()
        clone.remove()
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
      }

      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
    }

    node.addEventListener('pointerdown', onPointerDown)
    return {
      destroy() {
        node.removeEventListener('pointerdown', onPointerDown)
      },
    }
  }
}
