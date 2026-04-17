<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { Snippet } from 'svelte'
  import { GRID_ITEM_BODY_PADDING } from './const'
  import {
    moveHandleAction,
    resizeHandleAction,
    type GridInteractionController,
  } from './interaction'
  import GripVertical from 'lucide-svelte/icons/grip-vertical'
  import Copy from 'lucide-svelte/icons/copy'
  import X from 'lucide-svelte/icons/x'
  import { getGazePlotterSession } from '$lib/session'

  const { grid } = getGazePlotterSession()

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
    subtitle?: string
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
    subtitle,
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
  const isSelected = $derived(grid.selectedItemId === id)

  // Any of these — either native interactive controls OR elements explicitly
  // opted out via the `data-block-select` attribute (see blockGridSelect
  // action) — bypass the grid-item's click-to-select behavior and suppress
  // the dashed hover affordance.
  const BLOCK_SELECTOR =
    'button, a, [role="button"], input, select, textarea, [data-block-select]'

  function onFrameClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (target?.closest(BLOCK_SELECTOR)) return
    grid.toggleSelectedItem(id)
  }

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

  const resizeActionParamsTL = $derived({
    enabled: resizable,
    item,
    min: minimumSize,
    interaction,
    onCommit: (rect: GridRect) => onresize(rect),
    direction: 'tl' as const,
  })
  const resizeActionParamsTR = $derived({
    enabled: resizable,
    item,
    min: minimumSize,
    interaction,
    onCommit: (rect: GridRect) => onresize(rect),
    direction: 'tr' as const,
  })
  const resizeActionParamsBL = $derived({
    enabled: resizable,
    item,
    min: minimumSize,
    interaction,
    onCommit: (rect: GridRect) => onresize(rect),
    direction: 'bl' as const,
  })
  const resizeActionParamsBR = $derived({
    enabled: resizable,
    item,
    min: minimumSize,
    interaction,
    onCommit: (rect: GridRect) => onresize(rect),
    direction: 'br' as const,
  })
</script>

<div
  class="grid-item {customClass}"
  class:is-being-dragged={isDragging}
  class:resizing={isResizing}
  class:is-ghosted={isGhosted}
  style={itemStyle}
  transition:fade={{ duration: 150 }}
  role="figure"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="grid-item-frame"
    class:selected={isSelected}
    onclick={onFrameClick}
  >
    <div class="grid-item-header">
      <h3 class="grid-item-title">{title}</h3>
      {#if subtitle}
        <span class="grid-item-subtitle">{subtitle}</span>
      {/if}
    </div>

    <div class="grid-item-body">
      {#if body}
        {@render body()}
      {:else}
        {@render children?.()}
      {/if}
    </div>
  </div>

  {#if resizable && isSelected}
    <!-- Corner resize affordances. Placed outside the .grid-item-frame
         (which has overflow:hidden) so their half-outside-half-inside
         positioning isn't clipped. Only the bottom-right is currently
         wired to the resize action; the other three are visual for now
         so the selected state reads symmetrically. Each carries
         data-block-select so its clicks don't toggle selection. -->
    <div
      class="corner-handle top-left"
      data-block-select
      use:resizeHandleAction={resizeActionParamsTL}
      aria-hidden="true"
    ></div>
    <div
      class="corner-handle top-right"
      data-block-select
      use:resizeHandleAction={resizeActionParamsTR}
      aria-hidden="true"
    ></div>
    <div
      class="corner-handle bottom-left"
      data-block-select
      use:resizeHandleAction={resizeActionParamsBL}
      aria-hidden="true"
    ></div>
    <div
      class="corner-handle bottom-right"
      data-block-select
      use:resizeHandleAction={resizeActionParamsBR}
      aria-hidden="true"
    ></div>
  {/if}

  {#if isSelected && (isDraggableEnabled || removable)}
    <!-- Floating action toolbar. "Pops" out of the top of the blue frame
         on selection, grouping manipulation actions (move, duplicate,
         remove). Sibling of the frame so it isn't clipped by
         overflow:hidden. Each button carries data-block-select so clicks
         don't re-toggle selection. -->
    <div class="action-toolbar" data-block-select>
      {#if isDraggableEnabled}
        <button
          type="button"
          class="action-toolbar-button"
          use:moveHandleAction={moveActionParams}
          aria-label="Drag to move"
        >
          <GripVertical size={12} strokeWidth={1.75} aria-hidden="true" />
          <span>Move</span>
        </button>
        <button
          type="button"
          class="action-toolbar-button"
          onclick={() => onduplicate({ id })}
          aria-label="Duplicate item"
        >
          <Copy size={12} strokeWidth={1.75} aria-hidden="true" />
          <span>Duplicate</span>
        </button>
      {/if}
      {#if removable}
        <button
          type="button"
          class="action-toolbar-button danger"
          onclick={() => onremove({ id })}
          aria-label="Remove item"
        >
          <X size={12} strokeWidth={1.75} aria-hidden="true" />
          <span>Remove</span>
        </button>
      {/if}
    </div>
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
    border-radius: var(--rounded-lg, 8px);
    border: 1px solid var(--c-border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;

    /* Affordance ring sits ON TOP of the frame's existing 1px border
       (outline-offset: -1px + width 2px puts the outline from 1px inside
       to 1px outside the border-box edge, visually replacing the gray
       border with the accent colour when active). */
    outline: 2px dashed transparent;
    outline-offset: -1px;
    transition: outline-color 0.15s ease;
  }

  /* Suppress the hover affordance when the user is actually hovering an
     interactive child or a region explicitly marked with
     `data-block-select` (via the blockGridSelect action — plot figures,
     legends, etc.). Those have their own click semantics, and showing
     the selection hint at the same time would distract. */
  .grid-item-frame:hover:not(
      :has(
        :is(
            button,
            a,
            [role='button'],
            input,
            select,
            textarea,
            [data-block-select]
          ):hover
      )
    ) {
    outline-color: color-mix(in srgb, var(--c-info) 55%, transparent);
  }

  .grid-item-frame.selected {
    outline-style: solid;
    outline-color: var(--c-info);
  }

  .grid-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    min-height: 40px;
    box-sizing: border-box;
    background: var(--c-lightgrey);
    overflow: hidden;
    border-radius: var(--rounded-lg, 8px) var(--rounded-lg, 8px) 0 0;
  }

  .grid-item-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--c-black);
    line-height: 1.2;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grid-item-subtitle {
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.0333em;
    color: var(--c-darkgrey);
    line-height: 1.2;
    text-align: right;
    flex-shrink: 0;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grid-item-body {
    padding: var(--grid-item-body-padding);
    flex-grow: 1;
    overflow: auto;
    border-radius: var(--rounded-lg, 8px);
    background-color: var(--c-white);
  }

  /* Selected-state corner handles. Centered exactly on each corner of the
     blue outline (which itself sits on the frame's border). Handles, the
     outline and the border occupy the same visual ring — one cohesive
     selection frame. */
  .corner-handle {
    position: absolute;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--c-white);
    border: 1.5px solid var(--c-info);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
    box-sizing: border-box;
    z-index: 5;
    transition: background 0.12s ease;
  }
  .corner-handle:hover {
    background: var(--c-info);
  }
  .corner-handle.top-left {
    top: 0;
    left: 0;
    transform: translate(-50%, -50%);
    cursor: nwse-resize;
  }
  .corner-handle.top-right {
    top: 0;
    right: 0;
    transform: translate(50%, -50%);
    cursor: nesw-resize;
  }
  .corner-handle.bottom-left {
    bottom: 0;
    left: 0;
    transform: translate(-50%, 50%);
    cursor: nesw-resize;
  }
  .corner-handle.bottom-right {
    bottom: 0;
    right: 0;
    transform: translate(50%, 50%);
    cursor: nwse-resize;
  }

  /* Floating action toolbar "pops" out of the top of the blue frame on
     selection. White pill with blue border — same visual language as
     the corner handles, so selection chrome reads as one unified layer. */
  .action-toolbar {
    position: absolute;
    top: -3px;
    left: 50%;
    transform: translate(-50%, -100%);
    display: inline-flex;
    align-items: stretch;
    gap: 0;
    padding: 2px;
    background: var(--c-white);
    border: 1.5px solid var(--c-info);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
    z-index: 6;
    white-space: nowrap;
  }

  .action-toolbar-button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    background: transparent;
    color: var(--c-info);
    border: none;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s ease, color 0.1s ease;
  }
  .action-toolbar-button:hover {
    background: color-mix(in srgb, var(--c-info) 12%, transparent);
  }
  .action-toolbar-button.danger:hover {
    background: color-mix(in srgb, var(--c-error, #ff4d4f) 12%, transparent);
    color: var(--c-error, #ff4d4f);
  }
  .action-toolbar-button[aria-label='Drag to move'] {
    cursor: grab;
  }
  .action-toolbar-button[aria-label='Drag to move']:active {
    cursor: grabbing;
  }

  .header-content {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }
</style>
