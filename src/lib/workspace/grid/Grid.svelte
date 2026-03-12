<script lang="ts">
  import { onDestroy, type Component } from 'svelte'
  import { fade } from 'svelte/transition'
  import GridItem from './GridItem.svelte'
  import WorkspacePlotRenderer from './WorkspacePlotRenderer.svelte'
  import GeneralButtonMajor from '$lib/shared/components/GeneralButtonMajor.svelte'
  import { getGazePlotterSession, getGridState } from '$lib/session'
  import { getWorkspacePlotLabel } from './plotResolver'
  import type { AllGridTypes } from '$lib/workspace/type/gridType'
  import type { GridConfig } from './types'
  import { calculateBottomEdgePosition } from './utils'
  import { WORKSPACE_BOTTOM_PADDING, MIN_WORKSPACE_HEIGHT } from './const'
  import { throttleByRaf } from '$lib/shared/utils/throttle'
  import type {
    WorkspaceCommand,
    WorkspaceCommandChain,
  } from '$lib/workspace/commands'

  const grid = getGridState()
  const { errorService, workspace } = getGazePlotterSession()

  interface Props {
    // Grid state
    gridItems: AllGridTypes[]
    gridConfig: GridConfig
    gridHeight: number
    gridWidth: number
    gridIsEmpty: boolean

    // Workspace container reference
    workspaceContainer: HTMLElement | null
  }

  const {
    gridItems,
    gridConfig,
    gridHeight,
    gridWidth,
    gridIsEmpty,
    workspaceContainer,
  }: Props = $props()

  const dispatchWorkspaceCommand = (
    command: WorkspaceCommand | WorkspaceCommandChain
  ) => {
    if ('chainId' in command) {
      workspace.apply(command)
      return
    }

    workspace.applyRoot(command)
  }

  function getPlotErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error
    }

    return 'Unknown rendering error'
  }

  function reportPlotRenderError(
    item: AllGridTypes,
    plotName: string,
    error: unknown
  ): void {
    errorService.report({
      origin: 'plot',
      severity: 'recoverable',
      userMessage: `Plot "${plotName}" failed to render. The workspace is still active.`,
      cause: error,
      context: {
        itemId: item.id,
        plotName,
        plotType: item.type,
      },
    })
  }

  // ---------------------------------------------------
  // Panning state and handlers
  // ---------------------------------------------------
  let isPanning = $state(false)
  let lastPanX = 0
  let lastPanY = 0

  // ---------------------------------------------------
  // Item drag/resize state
  // ---------------------------------------------------
  let isDragging = $state(false)
  let draggedItemId = $state<number | null>(null)
  let isResizing = $state(false)
  let resizedItemId = $state<number | null>(null)

  // ---------------------------------------------------
  // Panning handlers
  // ---------------------------------------------------

  const handleWorkspacePanStart = (event: MouseEvent) => {
    if (event.button !== 0) return
    const targetEl = event.target as HTMLElement
    if (
      targetEl.closest('.grid-item') ||
      targetEl.closest('.grid-item-content')
    )
      return

    event.preventDefault()
    isPanning = true
    lastPanX = event.clientX
    lastPanY = event.clientY

    document.body.style.cursor = 'grabbing'
    if (workspaceContainer) workspaceContainer.style.cursor = 'grabbing'

    document.addEventListener('mousemove', handleWorkspacePanMove)
    document.addEventListener('mouseup', handleWorkspacePanEnd)
  }

  const handleWorkspacePanMove = throttleByRaf((event: MouseEvent) => {
    if (!isPanning || !workspaceContainer) return

    const rawDeltaX = event.clientX - lastPanX
    const rawDeltaY = event.clientY - lastPanY

    const dampingFactor = 0.6
    const deltaX = rawDeltaX * dampingFactor
    const deltaY = rawDeltaY * dampingFactor

    lastPanX = event.clientX
    lastPanY = event.clientY

    if (Math.abs(deltaX) > 0.5)
      setWorkspaceScrollX(getWorkspaceScrollX() - deltaX)
    if (Math.abs(deltaY) > 0.5)
      setWorkspaceScrollY(getWorkspaceScrollY() - deltaY)
  })

  const handleWorkspacePanEnd = () => {
    isPanning = false
    document.body.style.cursor = ''
    if (workspaceContainer) workspaceContainer.style.cursor = 'grab'
    endItemEdgeScroll()
    document.removeEventListener('mousemove', handleWorkspacePanMove)
    document.removeEventListener('mouseup', handleWorkspacePanEnd)
  }

  // ---------------------------------------------------
  // Item event handlers
  // ---------------------------------------------------

  const handleItemMove = (event: { id: number; x: number; y: number }) => {
    const currentItem = gridItems.find(
      (item: AllGridTypes) => item.id === event.id
    )
    if (currentItem) {
      const { type, id } = currentItem
      const source = `${type}.${id}.workspace`
      workspace.updateItemLayout(id, { x: event.x, y: event.y }, source)
    }
  }

  // Unified preview update handler: handles previewed x,y,w,h from move/resize/height updates
  const handlePreviewUpdate = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
  }) => {
    const requiredHeight = calculateWorkspaceHeight(event.id, event.y, event.h)
    grid.temporaryDragHeight = requiredHeight
  }

  const handleItemResize = (event: { id: number; w: number; h: number }) => {
    const currentItem = gridItems.find(
      (item: AllGridTypes) => item.id === event.id
    )
    if (!currentItem) return

    const { type, id } = currentItem
    const source = `${type}.${id}.workspace`

    const minWidth = Math.max(
      gridConfig.minWidth,
      currentItem.min?.w || gridConfig.minWidth
    )
    const minHeight = Math.max(
      gridConfig.minHeight,
      currentItem.min?.h || gridConfig.minHeight
    )

    const constrainedW = Math.max(minWidth, event.w)
    const constrainedH = Math.max(minHeight, event.h)

    workspace.updateItemLayout(id, { w: constrainedW, h: constrainedH }, source)
  }

  // Pointer tracking for central edge-detection
  let isPointerTracking = false
  const handleDocumentPointerMove = throttleByRaf(
    (event: MouseEvent | TouchEvent) => {
      if (!workspaceContainer || isPanning) return

      let clientX: number, clientY: number
      if ('touches' in event) {
        // Find first touch
        const touch = (event as TouchEvent).touches[0]
        if (!touch) return
        clientX = touch.clientX
        clientY = touch.clientY
      } else {
        clientX = (event as MouseEvent).clientX
        clientY = (event as MouseEvent).clientY
      }

      const activeId = draggedItemId ?? resizedItemId
      if (!activeId) return

      handleItemEdgeScroll({
        id: activeId,
        itemBounds: {
          left: clientX,
          right: clientX,
          top: clientY,
          bottom: clientY,
        },
        viewportBounds: {
          left: 0,
          top: 0,
          right: typeof window !== 'undefined' ? window.innerWidth : 0,
          bottom: typeof window !== 'undefined' ? window.innerHeight : 0,
        },
      })
    }
  )

  const startPointerTracking = () => {
    if (isPointerTracking) return
    isPointerTracking = true
    document.addEventListener('mousemove', handleDocumentPointerMove, {
      capture: true,
    })
    document.addEventListener('touchmove', handleDocumentPointerMove, {
      passive: false,
      capture: true,
    })
  }

  const stopPointerTracking = () => {
    if (!isPointerTracking) return
    isPointerTracking = false
    document.removeEventListener('mousemove', handleDocumentPointerMove, {
      capture: true,
    } as any)
    document.removeEventListener('touchmove', handleDocumentPointerMove, {
      capture: true,
    } as any)
    // Ensure auto-scroll stops
    endItemEdgeScroll()
  }

  const handleDragStart = (event: { id: number }) => {
    isDragging = true
    draggedItemId = event.id
    startPointerTracking()
  }

  const handleDragEnd = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
    dragComplete: boolean
  }) => {
    isDragging = false
    draggedItemId = null
    // Clear temporary drag height when drag ends
    grid.temporaryDragHeight = null
    grid.temporaryDragWidth = null
    stopPointerTracking()
  }

  const handleResizeStart = (event: { id: number }) => {
    isResizing = true
    resizedItemId = event.id
    startPointerTracking()
  }

  const handleResizeEnd = (event: {
    id: number
    x: number
    y: number
    w: number
    h: number
    resizeComplete: boolean
  }) => {
    isResizing = false
    resizedItemId = null
    // Clear temporary drag height when resize ends
    grid.temporaryDragHeight = null
    grid.temporaryDragWidth = null
    stopPointerTracking()
  }

  const handleItemRemove = (event: { id: number }) => {
    const itemToRemove = gridItems.find(
      (item: AllGridTypes) => item.id === event.id
    )
    if (itemToRemove) {
      workspace.removeVisualization(
        itemToRemove.id,
        `${itemToRemove.type}.${itemToRemove.id}.workspace`
      )
    }
  }

  const handleItemDuplicate = (event: { id: number }) => {
    const itemToDuplicate = gridItems.find(
      (item: AllGridTypes) => item.id === event.id
    )
    if (itemToDuplicate) {
      workspace.duplicateVisualization(
        itemToDuplicate.id,
        `${itemToDuplicate.type}.${itemToDuplicate.id}.workspace`
      )
    }
  }

  // ---------------------------------------------------
  // Auto-scrolling state
  // ---------------------------------------------------
  let isAutoScrolling = $state(false)
  let autoScrollDirection = $state({ x: 0, y: 0 })
  let autoScrollRafId: number | null = null
  const AUTO_SCROLL_AMOUNT = 5

  let currentSpeedX = 0
  let currentSpeedY = 0

  // ---------------------------------------------------
  // Scroll/Position Accessors
  // ---------------------------------------------------

  const getWorkspaceScrollX = () => workspaceContainer?.scrollLeft || 0
  const getWorkspaceScrollY = () =>
    typeof window !== 'undefined' ? window.scrollY : 0

  const setWorkspaceScrollX = (x: number) => {
    if (workspaceContainer) workspaceContainer.scrollLeft = x
  }

  const setWorkspaceScrollY = (y: number) => {
    if (typeof window !== 'undefined') window.scrollTo(0, y)
  }

  // ---------------------------------------------------
  // Utility functions
  // ---------------------------------------------------

  const calculateWorkspaceHeight = (id: number, y: number, h: number) => {
    const itemBottomEdge = calculateBottomEdgePosition(y, h, gridConfig)
    const otherItemsMaxBottom = Math.max(
      MIN_WORKSPACE_HEIGHT,
      ...gridItems
        .filter((item: AllGridTypes) => item.id !== id)
        .map((item: AllGridTypes) =>
          calculateBottomEdgePosition(item.y, item.h, gridConfig)
        )
    )

    return (
      Math.max(otherItemsMaxBottom, itemBottomEdge) + WORKSPACE_BOTTOM_PADDING
    )
  }

  onDestroy(() => {
    endItemEdgeScroll()
    stopPointerTracking()
  })

  // ---------------------------------------------------
  // Auto-scrolling logic (Fixed horizontal speed issue)
  // ---------------------------------------------------

  const handleItemEdgeScroll = (event: {
    id: number
    itemBounds: { left: number; right: number; top: number; bottom: number }
    viewportBounds: { left: number; right: number; top: number; bottom: number }
  }) => {
    if (!workspaceContainer || isPanning) return

    const { itemBounds } = event
    const edgeThreshold = 25

    const viewportBounds = {
      left: 0,
      top: 0,
      right: typeof window !== 'undefined' ? window.innerWidth : 0,
      bottom: typeof window !== 'undefined' ? window.innerHeight : 0,
    }

    // Sentinel to stop scrolling
    if (itemBounds.left > 999999 || itemBounds.right < -999999) {
      if (autoScrollRafId !== null) {
        cancelAnimationFrame(autoScrollRafId)
        autoScrollRafId = null
        isAutoScrolling = false
        autoScrollDirection = { x: 0, y: 0 }
        currentSpeedX = 0
        currentSpeedY = 0
      }
      return
    }

    let scrollX = 0
    let scrollY = 0

    if (itemBounds.right >= viewportBounds.right - edgeThreshold) {
      scrollX = 1
      const gridCellWidth = gridConfig.cellSize.width + gridConfig.gap
      // Update temporary drag width for horizontal expansion
      grid.temporaryDragWidth =
        (grid.width / gridCellWidth + AUTO_SCROLL_AMOUNT) * gridCellWidth
    } else if (itemBounds.left <= edgeThreshold) {
      if (getWorkspaceScrollX() > 0) scrollX = -1
    }

    if (itemBounds.bottom >= viewportBounds.bottom - edgeThreshold) {
      scrollY = 1
      const gridCellHeight = gridConfig.cellSize.height + gridConfig.gap
      // Update temporary drag height for vertical expansion
      grid.temporaryDragHeight =
        (grid.height / gridCellHeight + AUTO_SCROLL_AMOUNT) * gridCellHeight
    } else if (itemBounds.top <= edgeThreshold && getWorkspaceScrollY() > 0) {
      scrollY = -1
    }

    if (scrollX !== 0 || scrollY !== 0) {
      const wasAlreadyScrolling = !!autoScrollRafId

      if (
        autoScrollDirection.x !== scrollX ||
        autoScrollDirection.y !== scrollY
      ) {
        autoScrollDirection = { x: scrollX, y: scrollY }
      }

      isAutoScrolling = true

      if (!wasAlreadyScrolling) {
        const initialSpeed = 0.5
        const maxSpeed = 8 // Reduced from 14 to prevent excessive speed
        const acceleration = 0.08 // Reduced acceleration for smoother control
        const deceleration = 0.15 // Increased deceleration for faster stopping

        currentSpeedX = scrollX * initialSpeed
        currentSpeedY = scrollY * initialSpeed

        // RAF-driven scroll loop
        const step = () => {
          const scrollDirection = autoScrollDirection

          if (scrollDirection.x !== 0) {
            const currentX = getWorkspaceScrollX()
            let effectiveMaxSpeed = maxSpeed

            // Use linear scaling instead of quadratic for smoother control near edges
            if (scrollDirection.x < 0 && currentX < 150) {
              effectiveMaxSpeed = maxSpeed * (currentX / 150)
            }

            const targetSpeed = scrollDirection.x * effectiveMaxSpeed
            currentSpeedX =
              currentSpeedX + (targetSpeed - currentSpeedX) * acceleration
          } else {
            currentSpeedX =
              Math.abs(currentSpeedX) > 0.05
                ? currentSpeedX * (1 - deceleration)
                : 0
          }

          if (scrollDirection.y !== 0) {
            const currentY = getWorkspaceScrollY()
            let effectiveMaxSpeed = maxSpeed

            if (scrollDirection.y < 0 && currentY < 150) {
              effectiveMaxSpeed = maxSpeed * (currentY / 150)
            }

            const targetSpeed = scrollDirection.y * effectiveMaxSpeed
            currentSpeedY =
              currentSpeedY + (targetSpeed - currentSpeedY) * acceleration
          } else {
            currentSpeedY =
              Math.abs(currentSpeedY) > 0.05
                ? currentSpeedY * (1 - deceleration)
                : 0
          }

          if (Math.abs(currentSpeedX) > 0.05)
            setWorkspaceScrollX(getWorkspaceScrollX() + currentSpeedX)
          if (Math.abs(currentSpeedY) > 0.05)
            setWorkspaceScrollY(getWorkspaceScrollY() + currentSpeedY)

          // If both speeds are effectively zero and no direction, stop the loop
          if (
            Math.abs(currentSpeedX) < 0.05 &&
            Math.abs(currentSpeedY) < 0.05 &&
            autoScrollDirection.x === 0 &&
            autoScrollDirection.y === 0
          ) {
            if (autoScrollRafId !== null) {
              cancelAnimationFrame(autoScrollRafId)
              autoScrollRafId = null
              isAutoScrolling = false
              autoScrollDirection = { x: 0, y: 0 }
            }
            return
          }

          autoScrollRafId = requestAnimationFrame(step)
        }

        autoScrollRafId = requestAnimationFrame(step)
      }
    } else if (autoScrollRafId !== null) {
      autoScrollDirection = { x: 0, y: 0 }
    }
  }

  const endItemEdgeScroll = () => {
    if (autoScrollRafId !== null) {
      cancelAnimationFrame(autoScrollRafId)
      autoScrollRafId = null
      isAutoScrolling = false
      autoScrollDirection = { x: 0, y: 0 }
      currentSpeedX = 0
      currentSpeedY = 0
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="grid-container"
  class:pointer-events-none={isDragging || isResizing || isPanning}
  style="width: {gridWidth}px; height: {gridHeight}px;"
  onmousedown={handleWorkspacePanStart}
  role="application"
>
  {#if !gridIsEmpty}
    {#each gridItems as item (item.id)}
      {@const plotLabel = getWorkspacePlotLabel(item)}
        <div transition:fade={{ duration: 300 }}>
          <GridItem
            id={item.id}
            x={item.x}
            y={item.y}
            w={item.w}
            h={item.h}
            minW={item.min?.w || gridConfig.minWidth}
            minH={item.min?.h || gridConfig.minHeight}
            cellSize={gridConfig.cellSize}
            gap={gridConfig.gap}
            resizable={true}
            draggable={true}
            title={plotLabel}
            onpreviewupdate={handlePreviewUpdate}
            onmove={handleItemMove}
            onresize={handleItemResize}
            onresizestart={handleResizeStart}
            onresizeend={handleResizeEnd}
            ondragstart={handleDragStart}
            ondragend={handleDragEnd}
            onremove={handleItemRemove}
            onduplicate={handleItemDuplicate}
          >
            {#snippet body()}
              <div class="grid-item-content">
                <svelte:boundary
                  onerror={error =>
                    reportPlotRenderError(item, plotLabel, error)}
                >
                  <WorkspacePlotRenderer
                    {item}
                    onWorkspaceCommand={dispatchWorkspaceCommand}
                  />

                  {#snippet failed(error, reset)}
                    <div class="plot-error-state">
                      <p class="plot-error-copy">
                        {plotLabel} could not be displayed. The rest of the
                        workspace is still available.
                      </p>
                      <p class="plot-error-detail">
                        {getPlotErrorMessage(error)}
                      </p>
                      <GeneralButtonMajor
                        size="sm"
                        variant="secondary"
                        onclick={() => reset()}
                      >
                        Retry plot
                      </GeneralButtonMajor>
                    </div>
                  {/snippet}
                </svelte:boundary>
              </div>
            {/snippet}
          </GridItem>
        </div>
    {/each}
  {/if}
</div>

<style>
  /* Utility to block interactions during drag/resize */
  .pointer-events-none {
    pointer-events: none !important;
  }

  .plot-error-state {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0;
  }

  .plot-error-copy,
  .plot-error-detail {
    margin: 0;
    color: var(--c-text);
    line-height: 1.45;
    font-size: 0.9rem;
  }

  .plot-error-detail {
    color: var(--c-midgrey);
    overflow-wrap: anywhere;
  }
</style>
