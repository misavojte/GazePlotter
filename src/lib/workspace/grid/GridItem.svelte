<script lang="ts">
  import { fade } from 'svelte/transition'
  import GridItemButton from './GridItemButton.svelte'
  import GridItemContainer from './GridItemContainer.svelte'
  import { type Snippet } from 'svelte'
  import { draggable, resizable as resizableAction } from './actions.svelte'

  // Reusable types for props (concise)
  type GridRect = { id: number; x: number; y: number; w: number; h: number }

  type PreviewUpdate = {
    id: number
    x: number
    y: number
    w: number
    h: number
  }

  type IdOnly = { id: number }
  type GridEvent<T> = (payload: T) => void

  // GridItem properties
  interface Props {
    id: number
    x: number
    y: number
    w: number
    h: number
    minW?: number
    minH?: number
    cellSize?: { width: number; height: number }
    gap?: number
    resizable?: boolean
    draggable?: boolean
    title?: string
    removable?: boolean
    class?: string
    body?: Snippet
    children?: Snippet

    onmove?: GridEvent<GridRect>
    onpreviewupdate?: GridEvent<PreviewUpdate>
    onresize?: GridEvent<GridRect>
    ondragstart?: GridEvent<GridRect>
    ondragend?: GridEvent<GridRect & { dragComplete: boolean }>
    onresizestart?: GridEvent<GridRect>
    onresizeend?: GridEvent<GridRect & { resizeComplete: boolean }>
    onremove?: GridEvent<IdOnly>
    onduplicate?: GridEvent<IdOnly>
  }

  let {
    id,
    x,
    y,
    w,
    h,
    minW = 1,
    minH = 1,
    cellSize = { width: 40, height: 40 },
    gap = 10,
    resizable = true,
    draggable: isDraggableEnabled = true,
    title = '',
    removable = true,
    class: customClass = '',
    body,
    children,
    onmove = () => {},
    onpreviewupdate = () => {},
    onresize = () => {},
    ondragstart = () => {},
    ondragend = () => {},
    onresizestart = () => {},
    onresizeend = () => {},
    onremove = () => {},
    onduplicate = () => {},
  }: Props = $props()

  // Track state for visual feedback
  let isDragging = $state(false)
  let isResizing = $state(false)
  let dragPosition = $state({ x: 0, y: 0 })
  let resizePosition = $state({ w: 0, h: 0 })
  let showDragPlaceholder = $state(false)
  let showResizePlaceholder = $state(false)

  let bodyNode: HTMLElement | null = $state(null)
  let itemNode: HTMLElement | null = $state(null)

  // Calculate actual pixel dimensions and position
  let itemWidth = $derived(w * cellSize.width + (w - 1) * gap)
  let itemHeight = $derived(h * cellSize.height + (h - 1) * gap)
  let itemX = $derived(x * (cellSize.width + gap))
  let itemY = $derived(y * (cellSize.height + gap))

  // Style for the actual item (always at its real position)
  let itemStyle = $derived(`
    transform: translate(${itemX}px, ${itemY}px);
    width: ${itemWidth}px;
    height: ${itemHeight}px;
  `)

  // Style for the drag placeholder
  let placeholderStyle = $derived(
    showDragPlaceholder
      ? `
    transform: translate(${dragPosition.x * (cellSize.width + gap)}px, ${dragPosition.y * (cellSize.height + gap)}px);
    width: ${itemWidth}px;
    height: ${itemHeight}px;
  `
      : showResizePlaceholder
        ? `
    transform: translate(${itemX}px, ${itemY}px);
    width: ${resizePosition.w * cellSize.width + (resizePosition.w - 1) * gap}px;
    height: ${resizePosition.h * cellSize.height + (resizePosition.h - 1) * gap}px;
  `
        : ''
  )

  // define draggable params
  let draggableParams = $derived({
    enabled: isDraggableEnabled,
    id,
    x,
    y,
    w,
    h,
    cellSize,
    gap,
    onDragStart: (rect: GridRect) => {
      isDragging = true
      showDragPlaceholder = true
      ondragstart(rect)
    },
    onDragEnd: (rect: GridRect & { dragComplete: boolean }) => {
      ondragend(rect)
      // Cleanup happens in onWrapEnd but we can ensure state consistency here
    },
    onMove: (rect: GridRect) => onmove(rect),
    onPreviewUpdate: (update: PreviewUpdate) => onpreviewupdate(update),
    onWrapStart: () => {
      isDragging = true
      showDragPlaceholder = true
      if (itemNode) itemNode.classList.add('is-being-dragged')
    },
    onWrapEnd: (finalX: number, finalY: number) => {
      isDragging = false
      showDragPlaceholder = false
      if (itemNode) itemNode.classList.remove('is-being-dragged')
      // We can ensure the final position is set if needed, but the move event should handle it
    },
    updateDragPosition: (newX: number, newY: number) => {
      dragPosition = { x: newX, y: newY }
    },
  })

  // define resizable params
  let resizableParams = $derived({
    enabled: resizable,
    id,
    x,
    y,
    w,
    h,
    minW,
    minH,
    cellSize,
    gap,
    onResizeStart: (rect: GridRect) => {
      isResizing = true
      showResizePlaceholder = true
      onresizestart(rect)
    },
    onResizeEnd: (rect: GridRect & { resizeComplete: boolean }) => {
      onresizeend(rect)
    },
    onResize: (rect: GridRect) => onresize(rect),
    onPreviewUpdate: (update: PreviewUpdate) => onpreviewupdate(update),
    onWrapStart: () => {
      isResizing = true
      showResizePlaceholder = true
      if (itemNode) itemNode.classList.add('is-being-resized')
    },
    onWrapEnd: (finalW: number, finalH: number) => {
      isResizing = false
      showResizePlaceholder = false
      if (itemNode) itemNode.classList.remove('is-being-resized')
    },
    updateResizePosition: (newW: number, newH: number) => {
      resizePosition = { w: newW, h: newH }
    },
  })
</script>

<!-- Actual grid item (stays in place until drag is complete) -->
<div
  class="grid-item {customClass}"
  class:is-being-dragged={isDragging}
  class:resizing={isResizing}
  style={itemStyle}
  data-id={id}
  data-grid-x={x}
  data-grid-y={y}
  data-grid-w={w}
  data-grid-h={h}
  transition:fade={{ duration: 150 }}
  bind:this={itemNode}
  role="figure"
>
  <GridItemContainer showResizeHandle={resizable} class="item-container">
    {#snippet header()}
      {#if isDraggableEnabled}
        <GridItemButton
          tooltip="Drag to move"
          useAction={true}
          actionFn={draggable}
          actionParams={draggableParams}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="16" r="1.5" />
            <circle cx="16" cy="8" r="1.5" />
            <circle cx="16" cy="16" r="1.5" />
          </svg>
        </GridItemButton>
        <GridItemButton
          action="duplicate"
          tooltip="Duplicate item"
          onclick={() => onduplicate({ id })}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="8" y="8" width="12" height="12" rx="2" ry="2" />
            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
          </svg>
        </GridItemButton>
      {/if}
      <h3>{title}</h3>
      <div class="header-content">
        {#if removable}
          <GridItemButton
            action="remove"
            tooltip="Remove item"
            onclick={() => onremove({ id })}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </GridItemButton>
        {/if}
      </div>
    {/snippet}
    {#snippet body()}
      <div bind:this={bodyNode}>
        {#if body}{@render body()}{:else}
          {@render children?.()}
        {/if}
      </div>
    {/snippet}
  </GridItemContainer>

  {#if resizable}
    <div
      class="resize-handle-interactive"
      use:resizableAction={resizableParams}
      aria-hidden="true"
    ></div>
  {/if}
</div>

<!-- Lightweight placeholder that moves during drag or resize -->
{#if showDragPlaceholder || showResizePlaceholder}
  <div
    class="grid-item placeholder"
    class:dragging={isDragging}
    class:resizing={isResizing}
    style={placeholderStyle}
    data-id={`placeholder-${id}`}
    transition:fade={{ duration: 100 }}
  >
    <GridItemContainer showResizeHandle={false} class="item-container">
      {#snippet body()}
        <!-- Empty placeholder body -->
      {/snippet}
    </GridItemContainer>
  </div>
{/if}

<style>
  .grid-item {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    /* Add GPU acceleration but in a way that doesn't interfere with events */
    will-change: transform, width, height;
    /* transition: transform 0.1s ease-out; Removed for snapping feel */
  }

  .grid-item.is-being-dragged {
    z-index: 100;
    opacity: 0.4;
  }

  .grid-item.resizing {
    z-index: 100;
    opacity: 0.4;
  }

  /* Ensure the inner container fills the grid item */
  :global(.item-container) {
    width: 100%;
    height: 100%;
  }

  /* Placeholder styling */
  .grid-item.placeholder {
    z-index: 50;
    pointer-events: none;
    opacity: 0.6;
    border: 2px dashed var(--c-darkgrey);
    border-radius: var(--rounded-lg, 8px) var(--rounded-lg, 8px) 0 0;
    background: rgba(0, 0, 0, 0.02);
    box-sizing: border-box; /* Ensure border doesn't add to width */
  }

  /* When dragging, the placeholder shows where it will land */
  .grid-item.placeholder.dragging {
    opacity: 0.5;
    background: rgba(var(--c-main-rgb, 0, 0, 0), 0.05);
    border-color: var(--c-main);
  }

  /* When resizing, the placeholder shows the new size */
  .grid-item.placeholder.resizing {
    opacity: 0.5;
    background: rgba(var(--c-main-rgb, 0, 0, 0), 0.05);
    border-color: var(--c-main);
  }

  /* Hide the actual inner container styles when in placeholder mode */
  .grid-item.placeholder :global(.grid-item-container) {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  .grid-item.placeholder :global(.grid-item-container .header),
  .grid-item.placeholder :global(.grid-item-container .body) {
    background: transparent !important;
    opacity: 0; /* Hide content in placeholder */
  }

  /* Resize handle interactive area (invisible but clickable) */
  .resize-handle-interactive {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 20px;
    height: 20px;
    cursor: se-resize;
    z-index: 10;
  }

  .header-content {
    display: flex;
    gap: 4px;
  }
</style>
