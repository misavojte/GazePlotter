<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { Snippet } from 'svelte'
  import GridItemButton from './GridItemButton.svelte'
  import { GRID_ITEM_BODY_PADDING } from './const'
  import {
    moveHandleAction,
    resizeHandleAction,
    type GridInteractionController,
  } from './interaction'

  type GridRect = { id: number; x: number; y: number; w: number; h: number }
  type IdOnly = { id: number }
  type GridEvent<T> = (payload: T) => void

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
    interaction: GridInteractionController
    onmove?: GridEvent<GridRect>
    onresize?: GridEvent<GridRect>
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
    interaction,
    onmove = () => {},
    onresize = () => {},
    onremove = () => {},
    onduplicate = () => {},
  }: Props = $props()

  const item = $derived({ id, x, y, w, h })
  const minimumSize = $derived({ w: minW, h: minH })
  const isDragging = $derived(
    interaction.activeItemId === id && interaction.mode === 'moving'
  )
  const isResizing = $derived(
    interaction.activeItemId === id && interaction.mode === 'resizing'
  )
  const isGhosted = $derived(interaction.isGhostedItem(id))

  const itemWidth = $derived(w * cellSize.width + (w - 1) * gap)
  const itemHeight = $derived(h * cellSize.height + (h - 1) * gap)
  const itemX = $derived(x * (cellSize.width + gap))
  const itemY = $derived(y * (cellSize.height + gap))

  const itemStyle = $derived(`
    transform: translate(${itemX}px, ${itemY}px);
    width: ${itemWidth}px;
    height: ${itemHeight}px;
    --grid-item-body-padding: ${GRID_ITEM_BODY_PADDING}px;
  `)

  const moveActionParams = $derived({
    enabled: isDraggableEnabled,
    item,
    interaction,
    onCommit: (rect: GridRect) => onmove(rect),
  })

  const resizeActionParams = $derived({
    enabled: resizable,
    item,
    min: minimumSize,
    interaction,
    onCommit: (rect: GridRect) => onresize(rect),
  })
</script>

<div
  class="grid-item {customClass}"
  class:is-being-dragged={isDragging}
  class:resizing={isResizing}
  class:is-ghosted={isGhosted}
  style={itemStyle}
  data-grid-block-pan="true"
  transition:fade={{ duration: 150 }}
  role="figure"
>
  <div class="grid-item-frame" class:rounded-bottom={!resizable}>
    <div class="grid-item-header">
      {#if isDraggableEnabled}
        <GridItemButton
          class="move-handle-button"
          tooltip="Drag to move"
          useAction={true}
          actionFn={moveHandleAction}
          actionParams={moveActionParams}
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
      <h3 class="grid-item-title">{title}</h3>
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
    </div>

    <div class="grid-item-body">
      {#if body}
        {@render body()}
      {:else}
        {@render children?.()}
      {/if}
    </div>

    {#if resizable}
      <div class="grid-item-resize-corner" aria-hidden="true"></div>
    {/if}
  </div>

  {#if resizable}
    <div
      class="resize-handle-interactive"
      use:resizeHandleAction={resizeActionParams}
      aria-hidden="true"
    ></div>
  {/if}
</div>

<style>
  .grid-item {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    will-change: transform, width, height;
    cursor: default;
  }

  .grid-item.is-being-dragged,
  .grid-item.resizing,
  .grid-item.is-ghosted {
    z-index: 100;
    opacity: 0.4;
  }

  .grid-item-frame {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    background-color: var(--c-lightgrey);
    border-radius: var(--rounded-lg, 8px) var(--rounded-lg, 8px) 0
      var(--rounded-lg, 8px);
    border: 1px solid var(--c-border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .grid-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: var(--c-lightgrey);
    flex-wrap: wrap;
    gap: 2px 4px;
    overflow: hidden;
    border-radius: var(--rounded-lg, 8px) var(--rounded-lg, 8px) 0 0;
  }

  .grid-item-title {
    margin: 2px 0 2px 4px;
    flex-grow: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--c-black);
  }

  .grid-item-body {
    padding: var(--grid-item-body-padding);
    flex-grow: 1;
    overflow: auto;
    border-radius: 15px 15px 0 15px;
    background-color: var(--c-white);
  }

  .grid-item-frame.rounded-bottom {
    border-radius: var(--rounded-lg, 8px);
  }

  .grid-item-frame.rounded-bottom .grid-item-body {
    border-radius: 10px;
  }

  .grid-item-resize-corner {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    background: transparent;
    pointer-events: none;
    cursor: se-resize;
  }

  .grid-item-resize-corner::after {
    content: '';
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 8px;
    height: 8px;
    border-right: 2px solid var(--c-midgrey);
    border-bottom: 2px solid var(--c-midgrey);
  }

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
