<script lang="ts">
  import {
    WorkspaceItem,
    WorkspaceIndicatorEmpty,
    WorkspaceIndicatorLoading,
    WorkspaceToolbar,
    processingFileStateStore,
    visualizationRegistry, // Constant
    getVisualizationConfig, // Constant
  } from '$lib/workspace'
  import { grid } from '$lib/workspace/grid'
  import { generateUniqueId } from '$lib/shared/utils/idUtils'
  import { fade } from 'svelte/transition'
  import { onDestroy } from 'svelte'
  import {
    calculateBottomEdgePosition,
    WORKSPACE_BOTTOM_PADDING,
    MIN_WORKSPACE_HEIGHT,
    DEFAULT_GRID_CONFIG,
  } from '$lib/workspace/grid'
  import { throttleByRaf } from '$lib/shared/utils/throttle'
  import { addSuccessToast, addErrorToast } from '$lib/toaster'
  import { createCommandHandler } from '$lib/workspace/commands'
  import type {
    WorkspaceCommand,
    WorkspaceCommandChain,
  } from '$lib/workspace/commands'
  import { createRootCommand } from '$lib/workspace/commands'
  import type { AllGridTypes } from '$lib/workspace/type/gridType'

  interface Props {
    onReinitialize: () => void
    onWorkspaceCommandChain: (command: WorkspaceCommandChain) => void
    initialLayoutState?: Array<Partial<AllGridTypes> & { type: string }> | null
  }

  const {
    onReinitialize,
    onWorkspaceCommandChain,
    initialLayoutState = null,
  }: Props = $props()

  const gridConfig = DEFAULT_GRID_CONFIG

  // ---------------------------------------------------
  // State tracking (Svelte 5 Runes)
  // ---------------------------------------------------

  // Sync external file processing state with the grid class
  $effect(() => {
    grid.isLoading = $processingFileStateStore === 'processing'
  })

  // Local UI state as runes
  let isDragging = $state(false)
  let draggedItemId = $state<number | null>(null)
  let isResizing = $state(false)
  let resizedItemId = $state<number | null>(null)
  let isPanning = $state(false)

  // Auto-scrolling state
  let isAutoScrolling = $state(false)
  let autoScrollDirection = $state({ x: 0, y: 0 })
  let autoScrollInterval: number | null = null
  const AUTO_SCROLL_AMOUNT = 5

  let currentSpeedX = 0
  let currentSpeedY = 0

  let lastPanX = 0
  let lastPanY = 0

  let workspaceContainer: HTMLElement | null = $state(null)

  // ---------------------------------------------------
  // Initialization Logic
  // ---------------------------------------------------

  $effect(() => {
    if (workspaceContainer) {
      workspaceContainer.scrollLeft = 0
    }
  })

  const visualizations = Object.entries(visualizationRegistry).map(
    ([id, config]) => ({
      id,
      label: config.name,
    })
  )

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

  const createOperationHandler = <T extends { id: number }>(options: {
    operationType?: 'move' | 'resize' | 'preview' | 'start' | 'end'
    stateUpdater?: (id: number, isActive: boolean) => void
    heightUpdater?: (event: T) => void
    gridAction?: (event: T) => void
  }) => {
    const { operationType, stateUpdater, heightUpdater, gridAction } = options

    return (event: T) => {
      const { id } = event

      if (stateUpdater && operationType !== 'end') {
        stateUpdater(id, true)
      }

      if (
        heightUpdater &&
        (operationType === 'preview' ||
          operationType === 'move' ||
          operationType === 'resize')
      ) {
        heightUpdater(event)
      }

      if (gridAction) {
        gridAction(event)
      }

      if (operationType === 'end') {
        isDragging = false
        draggedItemId = null
        isResizing = false
        resizedItemId = null
        grid.temporaryDragHeight = null
        grid.temporaryDragWidth = null
        endItemEdgeScroll()
      }
    }
  }

  const calculateWorkspaceHeight = (id: number, y: number, h: number) => {
    const currentItems = grid.items

    const itemBottomEdge = calculateBottomEdgePosition(y, h, gridConfig)
    const otherItemsMaxBottom = Math.max(
      MIN_WORKSPACE_HEIGHT,
      ...currentItems
        .filter((item: AllGridTypes) => item.id !== id)
        .map((item: AllGridTypes) => calculateBottomEdgePosition(item.y, item.h, gridConfig))
    )

    return (
      Math.max(otherItemsMaxBottom, itemBottomEdge) + WORKSPACE_BOTTOM_PADDING
    )
  }

  onDestroy(() => {
    endItemEdgeScroll()
  })

  // ---------------------------------------------------
  // Event handlers
  // ---------------------------------------------------

  const handleItemPreviewMove = createOperationHandler({
    operationType: 'preview',
    heightUpdater: (event: { id: number; previewY: number; h: number }) => {
      grid.temporaryDragHeight = calculateWorkspaceHeight(
        event.id,
        event.previewY,
        event.h
      )
    },
  })

  const handleItemEdgeDetection = (
    event: Parameters<typeof handleItemEdgeScroll>[0]
  ) => {
    handleItemEdgeScroll(event)
  }

  const handleItemPreviewResize = createOperationHandler({
    operationType: 'preview',
    stateUpdater: id => {
      isResizing = true
      resizedItemId = id
    },
    heightUpdater: (event: { id: number; y: number; h: number }) => {
      grid.temporaryDragHeight = calculateWorkspaceHeight(
        event.id,
        event.y,
        event.h
      )
    },
  })

  const handleDragHeightUpdate = createOperationHandler({
    operationType: 'preview',
    heightUpdater: (event: { id: number; y: number; h: number }) => {
      grid.temporaryDragHeight = calculateWorkspaceHeight(
        event.id,
        event.y,
        event.h
      )
    },
  })

  const handleDragStart = createOperationHandler({
    operationType: 'start',
    stateUpdater: id => {
      isDragging = true
      draggedItemId = id
    },
  })

  const handleItemMove = createOperationHandler({
    operationType: 'move',
    gridAction: (event: { id: number; x: number; y: number }) => {
      const currentItem = grid.items.find((item: AllGridTypes) => item.id === event.id)
      if (currentItem) {
        const { type, id } = currentItem
        const source = `${type}.${id}.workspace`
        handleWorkspaceCommand({
          type: 'updateSettings',
          itemId: id,
          settings: { x: event.x, y: event.y },
          source,
        })
      }
    },
  })

  const handleItemResize = createOperationHandler({
    operationType: 'resize',
    gridAction: (event: { id: number; w: number; h: number }) => {
      const currentItem = grid.items.find((item: AllGridTypes) => item.id === event.id)
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

      handleWorkspaceCommand({
        type: 'updateSettings',
        itemId: id,
        settings: { w: constrainedW, h: constrainedH },
        source,
      })
    },
  })

  const handleDragEnd = createOperationHandler({
    operationType: 'end',
    gridAction: () => endItemEdgeScroll(),
  })

  const handleResizeEnd = createOperationHandler({
    operationType: 'end',
    gridAction: () => endItemEdgeScroll(),
  })

  const handleItemRemove = createOperationHandler({
    gridAction: (event: { id: number }) => {
      const itemToRemove = grid.items.find((item: AllGridTypes) => item.id === event.id)
      if (itemToRemove) {
        handleWorkspaceCommand({
          type: 'removeGridItem',
          itemId: itemToRemove.id,
          source: `${itemToRemove.type}.${itemToRemove.id}.workspace`,
        })
      }
    },
  })

  const handleItemDuplicate = createOperationHandler({
    gridAction: (event: { id: number }) => {
      const itemToDuplicate = grid.items.find((item: AllGridTypes) => item.id === event.id)
      if (itemToDuplicate) {
        handleWorkspaceCommand({
          type: 'duplicateGridItem',
          itemId: itemToDuplicate.id,
          duplicateId: generateUniqueId(),
          source: `${itemToDuplicate.type}.${itemToDuplicate.id}.workspace`,
        })
      }
    },
  })

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
  // Auto-scrolling logic (Logic preserved exactly)
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

    if (itemBounds.left > 999999 || itemBounds.right < -999999) {
      if (autoScrollInterval !== null) {
        clearInterval(autoScrollInterval)
        autoScrollInterval = null
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
      const gridCellWidth = grid.config.cellSize.width + grid.config.gap
      grid.temporaryDragWidth =
        (grid.width / gridCellWidth + AUTO_SCROLL_AMOUNT) * gridCellWidth
    } else if (itemBounds.left <= edgeThreshold) {
      if (getWorkspaceScrollX() > 0) scrollX = -1
    }

    if (itemBounds.bottom >= viewportBounds.bottom - edgeThreshold) {
      scrollY = 1
      const gridCellHeight = grid.config.cellSize.height + grid.config.gap
      grid.temporaryDragHeight =
        (grid.height / gridCellHeight + AUTO_SCROLL_AMOUNT) * gridCellHeight
    } else if (itemBounds.top <= edgeThreshold && getWorkspaceScrollY() > 0) {
      scrollY = -1
    }

    if (scrollX !== 0 || scrollY !== 0) {
      const wasAlreadyScrolling = !!autoScrollInterval

      if (
        autoScrollDirection.x !== scrollX ||
        autoScrollDirection.y !== scrollY
      ) {
        autoScrollDirection = { x: scrollX, y: scrollY }
      }

      isAutoScrolling = true

      if (!wasAlreadyScrolling) {
        const initialSpeed = 0.5
        const maxSpeed = 14
        const acceleration = 0.1
        const deceleration = 0.1

        currentSpeedX = scrollX * initialSpeed
        currentSpeedY = scrollY * initialSpeed

        autoScrollInterval = setInterval(() => {
          const scrollDirection = autoScrollDirection

          if (scrollDirection.x !== 0) {
            const currentX = getWorkspaceScrollX()
            let effectiveMaxSpeed = maxSpeed
            if (scrollDirection.x < 0 && currentX < 150) {
              effectiveMaxSpeed = maxSpeed * Math.pow(currentX / 150, 2)
            }
            const targetSpeed = scrollDirection.x * effectiveMaxSpeed
            currentSpeedX =
              currentSpeedX + (targetSpeed - currentSpeedX) * acceleration
          } else {
            currentSpeedX =
              Math.abs(currentSpeedX) > 0.1
                ? currentSpeedX * (1 - deceleration)
                : 0
          }

          if (scrollDirection.y !== 0) {
            const currentY = getWorkspaceScrollY()
            let effectiveMaxSpeed = maxSpeed
            if (scrollDirection.y < 0 && currentY < 150) {
              effectiveMaxSpeed = maxSpeed * Math.pow(currentY / 150, 2)
            }
            const targetSpeed = scrollDirection.y * effectiveMaxSpeed
            currentSpeedY =
              currentSpeedY + (targetSpeed - currentSpeedY) * acceleration
          } else {
            currentSpeedY =
              Math.abs(currentSpeedY) > 0.1
                ? currentSpeedY * (1 - deceleration)
                : 0
          }

          if (Math.abs(currentSpeedX) > 0.1)
            setWorkspaceScrollX(getWorkspaceScrollX() + currentSpeedX)
          if (Math.abs(currentSpeedY) > 0.1)
            setWorkspaceScrollY(getWorkspaceScrollY() + currentSpeedY)

          if (Math.abs(currentSpeedX) < 0.1 && Math.abs(currentSpeedY) < 0.1) {
            if (autoScrollInterval !== null) {
              clearInterval(autoScrollInterval)
              autoScrollInterval = null
              isAutoScrolling = false
              autoScrollDirection = { x: 0, y: 0 }
            }
          }
        }, 16) as unknown as number
      }
    } else if (autoScrollInterval !== null) {
      autoScrollDirection = { x: 0, y: 0 }
    }
  }

  const endItemEdgeScroll = () => {
    if (autoScrollInterval !== null) {
      clearInterval(autoScrollInterval)
      autoScrollInterval = null
      isAutoScrolling = false
      autoScrollDirection = { x: 0, y: 0 }
      currentSpeedX = 0
      currentSpeedY = 0
    }
  }

  // ---------------------------------------------------
  // Command Orchestration
  // ---------------------------------------------------

  const handleCommand = createCommandHandler(
    grid, // Synchronous class instance
    message => addSuccessToast(message),
    error => {
      console.error('Command error:', error)
      addErrorToast('Error applying changes. See console for details.')
    },
    command => onWorkspaceCommandChain(command)
  )

  const handleWorkspaceCommand = (
    command: WorkspaceCommand | WorkspaceCommandChain
  ) => {
    if ('chainId' in command) {
      handleCommand(command)
      return
    }
    handleCommand(createRootCommand(command))
  }

  const styleProps = `--min-workspace-height: ${MIN_WORKSPACE_HEIGHT}px; --grid-container-min-height: ${MIN_WORKSPACE_HEIGHT - 100}px;`
</script>

<div class="workspace-wrapper" style={styleProps}>
  <WorkspaceToolbar
    onWorkspaceCommand={handleWorkspaceCommand}
    {initialLayoutState}
    {visualizations}
  />

  <div
    class="workspace-container"
    style="height: {grid.height}px;"
    bind:this={workspaceContainer}
    onmousedown={handleWorkspacePanStart}
    role="none"
    class:is-panning={isPanning}
  >
    <div class="grid-container" style="width: {grid.width}px;">
      {#if $processingFileStateStore === 'done'}
        {#if !grid.isEmpty}
          {#each grid.items as item (item.id)}
            {@const visConfig = getVisualizationConfig(item.type)}
            <div transition:fade={{ duration: 300 }}>
              <WorkspaceItem
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
                title={visConfig.name}
                class={item.id === resizedItemId ? 'is-being-resized' : ''}
                onpreviewmove={handleItemPreviewMove}
                onmove={handleItemMove}
                onpreviewresize={handleItemPreviewResize}
                onresize={handleItemResize}
                onresizeend={handleResizeEnd}
                ondragstart={handleDragStart}
                ondragend={handleDragEnd}
                ondrag_height_update={handleDragHeightUpdate}
                onremove={handleItemRemove}
                onduplicate={handleItemDuplicate}
                onedgedetection={handleItemEdgeDetection}
              >
                {#snippet body()}
                  <div class="grid-item-content">
                    <visConfig.component
                      settings={item}
                      onWorkspaceCommand={handleWorkspaceCommand}
                    />
                  </div>
                {/snippet}
              </WorkspaceItem>
            </div>
          {/each}
        {/if}
      {/if}
    </div>

    {#if isDragging || isPanning}
      <div
        class="pointer-events-blocker"
        transition:fade={{ duration: 50 }}
      ></div>
    {/if}

    {#if grid.isEmpty && !($processingFileStateStore === 'processing' || grid.isLoading)}
      <WorkspaceIndicatorEmpty
        {onReinitialize}
        onWorkspaceCommand={handleWorkspaceCommand}
        {initialLayoutState}
      />
    {/if}

    {#if $processingFileStateStore === 'processing' || grid.isLoading}
      <WorkspaceIndicatorLoading />
    {/if}
  </div>
</div>

<style>
  .workspace-wrapper {
    position: relative;
    display: flex;
    min-height: var(--min-workspace-height);
    border: 1px solid #8888889c;
  }

  .workspace-container {
    box-sizing: border-box;
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    z-index: 1;
    transition: height 0.3s ease-out;
    overflow-x: auto;
    overflow-y: hidden;
    min-height: var(--min-workspace-height);
    padding: 35px;
    will-change: height;
    cursor: grab;
    background-color: var(--c-darkwhite);
    background-image: radial-gradient(
      circle,
      var(--c-grey) 2px,
      transparent 2px
    );
    background-size: 50px 50px;
    background-position: 5px 5px;
    background-attachment: local;
  }

  .workspace-container.is-panning {
    cursor: grabbing;
  }

  .grid-container {
    position: relative;
    width: 100%;
    min-height: var(--grid-container-min-height);
    background-color: transparent;
    transition: height 0.3s ease-out;
    overflow-x: visible;
    overflow-y: visible;
    will-change: contents;
    transform: translateZ(0);
  }

  :global(.grid-item) {
    cursor: default;
  }

  :global(.resize-handle) {
    cursor: se-resize !important;
    z-index: 100 !important;
  }

  :global(.header > .tooltip-wrapper:first-child .workspace-item-button) {
    cursor: grab !important;
  }

  :global(
    .header > .tooltip-wrapper:first-child .workspace-item-button:active
  ) {
    cursor: grabbing !important;
  }

  .pointer-events-blocker {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    background-color: transparent;
    pointer-events: all;
    cursor: grabbing;
  }
</style>
