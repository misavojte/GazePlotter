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
  transition:fade={{ duration: 150 }}
  role="figure"
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="grid-item-frame"
    class:rounded-bottom={!resizable}
    class:selected={isSelected}
    onclick={onFrameClick}
  >
    <div class="grid-item-header">
      {#if isDraggableEnabled && isSelected}
        <GridItemButton
          class="move-handle-button"
          tooltip="Drag to move"
          useAction={true}
          actionFn={moveHandleAction}
          actionParams={moveActionParams}
        >
          <GripVertical size={14} strokeWidth={1.75} aria-hidden="true" />
        </GridItemButton>
      {/if}
      <div class="grid-item-heading">
        <h3 class="grid-item-title">{title}</h3>
        {#if subtitle}
          <span class="grid-item-subtitle">{subtitle}</span>
        {/if}
      </div>
      <div class="header-content">
        {#if removable}
          <GridItemButton
            action="remove"
            tooltip="Remove item"
            onclick={() => onremove({ id })}
          >
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
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
      aria-hidden="true"
    ></div>
    <div
      class="corner-handle top-right"
      data-block-select
      aria-hidden="true"
    ></div>
    <div
      class="corner-handle bottom-left"
      data-block-select
      aria-hidden="true"
    ></div>
    <div
      class="corner-handle bottom-right"
      data-block-select
      use:resizeHandleAction={resizeActionParams}
      aria-hidden="true"
    ></div>
  {/if}

  {#if isDraggableEnabled && isSelected}
    <!-- "Pops" out of the blue frame, above the header, as a floating
         pill with icon + text. Sibling of the frame so it isn't clipped
         by overflow:hidden. Carries data-block-select so clicking it
         doesn't re-toggle selection. -->
    <button
      type="button"
      class="pop-action pop-action-duplicate"
      onclick={() => onduplicate({ id })}
      data-block-select
    >
      <Copy size={12} strokeWidth={1.75} aria-hidden="true" />
      <span>Duplicate</span>
    </button>
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

    /* Affordance ring sits 2px OUTSIDE the frame. Invisible by default;
       lights up on hover (dashed, as "this chart can be selected") and
       is promoted to solid when the plot is actually selected. */
    outline: 2px dashed transparent;
    outline-offset: 2px;
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
    padding: 8px 16px;
    background: var(--c-lightgrey);
    flex-wrap: wrap;
    gap: 2px 4px;
    overflow: hidden;
    border-radius: var(--rounded-lg, 8px) var(--rounded-lg, 8px) 0 0;
  }

  .grid-item-heading {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: 2px 6px;
    min-width: 0;
    max-width: 100%;
  }

  .grid-item-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--c-black);
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grid-item-subtitle {
    font-size: 8px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.0333em;
    color: var(--c-darkgrey);
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  /* Selected-state manipulation affordances: four small circles that sit
     exactly on the blue outline's centerline, one per corner. Standard
     Figma/canvas-editor pattern — the outline + circles read as a single
     integrated selection frame.

     Geometry: the frame's outline is drawn with `outline: 2px solid;
     outline-offset: 2px`, so the outline's centerline runs 3px outside
     the frame edge (offset 2 + half width 1). Placing each circle's
     center at exactly that offset visually welds the handles to the
     outline. Width/height 9px with a 1.5px border matches the outline's
     thickness for a clean silhouette. */
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
    transition: transform 0.1s ease, background 0.12s ease;
  }
  .corner-handle:hover {
    background: var(--c-info);
  }
  .corner-handle.top-left {
    top: -3px;
    left: -3px;
    transform: translate(-50%, -50%);
    cursor: nwse-resize;
  }
  .corner-handle.top-right {
    top: -3px;
    right: -3px;
    transform: translate(50%, -50%);
    cursor: nesw-resize;
  }
  .corner-handle.bottom-left {
    bottom: -3px;
    left: -3px;
    transform: translate(-50%, 50%);
    cursor: nesw-resize;
  }
  .corner-handle.bottom-right {
    bottom: -3px;
    right: -3px;
    transform: translate(50%, 50%);
    cursor: nwse-resize;
  }

  /* Floating "pop" action button that emerges from the blue frame when
     the item is selected. Same blue treatment as the outline + corner
     handles for a unified look. */
  .pop-action {
    position: absolute;
    top: -3px;
    left: 50%;
    transform: translate(-50%, -100%);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--c-info);
    color: var(--c-white);
    border: none;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    z-index: 6;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.15);
    transition: background 0.12s ease, box-shadow 0.12s ease;
  }
  .pop-action:hover {
    background: color-mix(in srgb, var(--c-info) 85%, black);
    box-shadow: 0 3px 8px rgba(15, 23, 42, 0.2);
  }
  .pop-action span {
    letter-spacing: 0.01em;
  }

  .header-content {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }
</style>
