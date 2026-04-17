<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { Snippet } from 'svelte'
  import { GRID_ITEM_BODY_PADDING } from './const'
  import {
    moveHandleAction,
    resizeHandleAction,
    type GridInteractionController,
  } from './interaction'
  import Copy from 'lucide-svelte/icons/copy'
  import X from 'lucide-svelte/icons/x'
  import { getGazePlotterSession } from '$lib/session'
  import type { PlotSubtitleParts } from '$lib/plots/definePlot'

  const { grid } = getGazePlotterSession()

  type GridRect = { id: number; x: number; y: number; w: number; h: number }
  type IdOnly = { id: number }
  type DuplicateRequest = { id: number; clientX: number; clientY: number }
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
    subtitle?: PlotSubtitleParts
    removable?: boolean
    class?: string
    body?: Snippet
    children?: Snippet
    interaction: GridInteractionController
    onmove?: GridEvent<GridRect>
    onresize?: GridEvent<GridRect>
    onremove?: GridEvent<IdOnly>
    onduplicate?: GridEvent<DuplicateRequest>
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

  // Frame-level drag: once the item is selected, the whole frame is a
  // drag target (title bar, padding, empty plot chrome) — there's no
  // dedicated Move button anymore. `shouldStart` carves out regions
  // that have their own click semantics (buttons, inputs, plot canvas)
  // via the same BLOCK_SELECTOR the frame click handler uses.
  // `moveHandleAction` waits for a 3px drag threshold before starting
  // the interaction, so a plain click on the frame still toggles
  // selection cleanly rather than spawning a no-op move session.
  const frameMoveActionParams = $derived({
    enabled: isDraggableEnabled && isSelected,
    item,
    interaction,
    onCommit: (rect: GridRect) => onmove(rect),
    shouldStart: (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return false
      if (target.closest(BLOCK_SELECTOR)) return false
      return true
    },
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
  class:selected={isSelected}
  style={itemStyle}
  transition:fade={{ duration: 150 }}
  role="figure"
>
  {#if isSelected}
    <!-- Solid blue square tucked behind the plot frame at the top-right.
         The frame has a rounded top-right corner, which normally lets the
         workspace background bleed through the 8×8 arc cutout — breaking
         the visual continuity between the selection rail (above the frame)
         and the selection outline (around the frame). This square sits in
         front of the workspace background and behind the frame, so the
         rounded cutout renders as solid c-info instead of page chrome,
         "squaring off" the corner visually while the frame itself stays
         rounded. aria-hidden: pure decoration. -->
    <div class="selection-corner-fill" aria-hidden="true"></div>
  {/if}

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="grid-item-frame"
    class:selected={isSelected}
    onclick={onFrameClick}
    use:moveHandleAction={frameMoveActionParams}
  >
    <div class="grid-item-header">
      <h3 class="grid-item-title">{title}</h3>
      {#if subtitle && subtitle.length > 0}
        <div class="grid-item-subtitle">
          {#each subtitle as part, i (part.label)}
            {#if i > 0}
              <span class="grid-item-subtitle-divider" aria-hidden="true"></span>
            {/if}
            <div class="grid-item-subtitle-part">
              <span class="grid-item-subtitle-label">{part.label}</span>
              <span class="grid-item-subtitle-value">{part.value}</span>
            </div>
          {/each}
        </div>
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
    <!-- Compact action chip anchored at the top-left, sitting on the
         selection outline's top edge. Pill-shaped with both top corners
         rounded; sibling of the frame so it isn't clipped by
         overflow:hidden. The selection-corner-fill above paints the
         frame's rounded top-left cutout so the chip reads as an
         integral extension of the selection. -->
    <!-- No Move button here: the whole frame is already a drag target
         when selected (`cursor: move` signals it), so a dedicated
         Move button duplicates the affordance and mixes drag-to-act
         with the click-to-act Duplicate/Remove buttons next to it. -->
    <div class="action-toolbar" data-block-select>
      {#if isDraggableEnabled}
        <button
          type="button"
          class="action-toolbar-button"
          onclick={e =>
            onduplicate({ id, clientX: e.clientX, clientY: e.clientY })}
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

  /* Selected items render above unselected peers. Without this, the
     action chip (anchored via `translateY(-100%)` so it sits *above* the
     frame's top edge) gets obscured by any neighbor grid item whose box
     overlaps that strip — selection outline and resize handles have the
     same problem. `is-being-dragged` / `resizing` / `is-ghosted` already
     jump to 100 during the interaction; 10 gives static selection a
     clear lane above neighbors without competing with the drag layer.
     Intentionally uses a class directly on `.grid-item` rather than a
     `:has(.grid-item-frame.selected)` selector: `:has()` can resolve a
     frame later than normal selector matching, and for a just-duplicated
     item that lag shows up as the chip briefly rendering behind the
     neighbor above before z-index lifts it into place. */
  .grid-item.selected {
    z-index: 10;
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

    /* Affordance ring sits ON TOP of the frame's existing 1px border.
       Hover and selected share the 2px width so the visual "weight"
       doesn't jump when the user actually clicks — only the color
       intensity changes. Hover is a lighter blue (mixed toward white),
       selected is the full info-color. */
    outline: 2px solid transparent;
    outline-offset: -1px;
  }

  /* Suppress the hover affordance when:
     - the item is already selected (the solid selected ring is the
       authoritative state; layering a hover preview on top of it is
       redundant noise — desired: hover has no effect once selected); or
     - the user is actually hovering an interactive child or a region
       explicitly marked with `data-block-select` (via the blockGridSelect
       action — plot figures, legends, etc.). Those have their own click
       semantics, and showing the selection hint would distract. */
  .grid-item-frame:hover:not(.selected):not(
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
    outline-color: color-mix(in srgb, var(--c-info) 25%, #e2e8f0);
  }

  .grid-item-frame.selected {
    outline-color: var(--c-info);
    /* Signals the selected-frame "drag-from-anywhere" affordance: once an
       item is selected, the whole frame becomes a grab target (see
       frameMoveActionParams in the script). Children that have their own
       click semantics — anything inside `[data-block-select]` — reset to
       `auto` so the plot canvas, inputs, buttons etc. keep their own
       cursors. Interactive elements like buttons/links already carry
       their own `cursor: pointer`, so this mostly matters for canvas
       and static chrome inside figures. */
    cursor: move;
  }

  .grid-item-frame.selected [data-block-select] {
    cursor: auto;
  }

  .grid-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 25px;
    min-height: 47px;
    box-sizing: border-box;
    background: var(--c-lightgrey);
    overflow: hidden;
    border-radius: var(--rounded-lg, 8px) var(--rounded-lg, 8px) 0 0;
    user-select: none;
    -webkit-user-select: none;
  }

  .grid-item-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--c-black);
    line-height: 1.2;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Subtitle is a row of captioned parts divided by thin 1px separators
     (same visual language as the ribbon / rail dividers elsewhere in
     the workspace). Each part stacks a tiny uppercase label over a
     slightly larger non-uppercase value. */
  .grid-item-subtitle {
    display: flex;
    align-items: stretch;
    gap: 10px;
    flex-shrink: 0;
    max-width: 60%;
    min-width: 0;
  }

  .grid-item-subtitle-part {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .grid-item-subtitle-label {
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-darkgrey);
    line-height: 1;
  }

  .grid-item-subtitle-value {
    font-size: 11px;
    font-weight: 500;
    color: var(--c-darkgrey);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grid-item-subtitle-divider {
    width: 1px;
    align-self: stretch;
    background-color: #e2e8f0;
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
     selection frame. z-index is above the action toolbar so the
     top-left handle stays visible on top of the chip. */
  .corner-handle {
    position: absolute;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--c-white);
    border: 1.5px solid var(--c-info);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
    box-sizing: border-box;
    z-index: 7;
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

  /* Compact action chip anchored at the top-left, sitting on the
     selection outline's top edge (y = -1px). Pill-shaped with both top
     corners rounded at 6px; content-width so it doesn't stretch across
     the frame. */
  .action-toolbar {
    position: absolute;
    top: -1px;
    left: -1px;
    transform: translateY(-100%);
    display: inline-flex;
    align-items: stretch;
    gap: 0;
    padding: 2px 4px;
    background: var(--c-info);
    border: none;
    border-radius: 6px 6px 0 0;
    z-index: 6;
    white-space: nowrap;
  }

  /* Corner fill: sits behind the plot frame and in front of the
     workspace background at the top-left. Its purpose is to paint the
     ~8×8 px area the frame's rounded top-left corner cuts out, so the
     chip's bottom-left joins the selection outline in a continuous
     blue L-shape instead of being interrupted by a crescent of
     workspace background. z-index: -1 keeps it below the frame (which
     is at default z-index 0 inside the grid-item stacking context)
     while still staying within the grid-item's z-index 1 context so
     it doesn't escape the workspace layer. */
  .selection-corner-fill {
    position: absolute;
    top: -1px;
    left: -1px;
    width: calc(var(--rounded-lg, 8px) + 2px);
    height: calc(var(--rounded-lg, 8px) + 2px);
    background: var(--c-info);
    z-index: -1;
    pointer-events: none;
  }

  .action-toolbar-button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    background: transparent;
    color: var(--c-white);
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
    background: rgba(255, 255, 255, 0.18);
  }

  .header-content {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }
</style>
