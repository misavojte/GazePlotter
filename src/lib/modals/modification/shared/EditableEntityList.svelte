<script module lang="ts">
  import type { BaseInterpretedDataType } from '$lib/data/types'

  /** One rendered column of the entity grid. */
  export interface TableColumn {
    label: string
    width: string
    align?: 'center'
    /** 'action' renders a per-row icon button (leader rows only) firing the
        `grouped.onRowAction` callback. */
    type: 'handle' | 'readonly' | 'text' | 'color' | 'action'
    key?: string
    /** Icon for 'action' columns. */
    icon?: 'image'
    /** Explanatory tooltip on the column header (dotted-underlined). */
    tooltip?: string
  }

  /** Rows may carry a color; a `color` column is only configured by editors
      whose rows do (AOI, category, event channel). */
  export type EntityRow = BaseInterpretedDataType & { color?: string }
</script>

<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { flip } from 'svelte/animate'
  import { cubicOut } from 'svelte/easing'
  import Empty from '$lib/shared/components/Empty.svelte'
  import { InputColor, InputText } from '$lib/shared/components'
  import ArrowDownAZ from 'lucide-svelte/icons/arrow-down-a-z'
  import GripVertical from 'lucide-svelte/icons/grip-vertical'
  import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal'
  import Replace from 'lucide-svelte/icons/replace'
  import ImageIcon from 'lucide-svelte/icons/image'
  import { useTooltipAction } from '$lib/tooltip'

  const tooltipAction = useTooltipAction()
  import {
    useContextMenuAction,
    createMenuComponentItem,
    type MenuItem,
  } from '$lib/context-menu'

  const contextMenuAction = useContextMenuAction()
  import { createListReorder, type ListReorderConfig } from './listReorder.action'
  import type { MergeCard } from './groupedEntityEditor.svelte'
  import BulkActionsFlyout, {
    type BulkActionsFlyoutProps,
  } from './BulkActionsFlyout.svelte'

  interface SortColumn {
    label: string
    column: string
  }

  interface GroupedCallbacks {
    onNameInput: (
      item: BaseInterpretedDataType,
      name: string,
      isLeader: boolean,
      group: MergeCard<BaseInterpretedDataType>
    ) => void
    /** Only for entity lists with a color column. */
    onColorInput?: (
      group: MergeCard<BaseInterpretedDataType>,
      color: string
    ) => void
    /** Only for entity lists with an 'action' column (leader rows). */
    onRowAction?: (item: BaseInterpretedDataType) => void
    /** Fills the 'action' button (e.g. "this stimulus HAS media"). */
    rowActionActive?: (item: BaseInterpretedDataType) => boolean
    /** Hover explanation of the 'action' button per row. */
    rowActionTooltip?: (item: BaseInterpretedDataType) => string
  }

  interface GroupNotice {
    tone: 'info' | 'warn'
    message: string
    action?: { label: string; onClick: () => void }
  }

  interface Props {
    groups: MergeCard<EntityRow>[]
    title: string
    emptyMessage: string
    columns: TableColumn[]
    sortColumns: SortColumn[]
    grouped: GroupedCallbacks
    /** Per multi-member group: an inline notice/action row under its members
        (e.g. "these will merge" / "can't merge, undo rename"). */
    groupNotice?: (
      group: MergeCard<BaseInterpretedDataType>
    ) => GroupNotice | null
    /** Rows whose displayed name is a reserved identity anchor: the text
        column renders read-only for them (color/reorder stay live). */
    lockedNameIds?: ReadonlySet<number>
    onSort: (column: string, direction: 'asc' | 'desc') => void
    onReorder: ListReorderConfig['onReorder']
    /** Replace `pattern` with `replacement` across every matching name. */
    onRename: (pattern: string, replacement: string) => void
    /** First-class row selection: clicking a card (outside its controls)
        toggles it, shift-click extends a range, selected cards carry a calm
        solid ring + tint. The parent decides what the selection MEANS —
        a transient working set (merge / color / save / multi-drag) or, while
        a SELECTION chip is active, that chip's membership. `inert` cards
        (empty displayed names during chip editing) neither ring nor toggle.
        Grouped mode only. */
    selection: {
      selected: ReadonlySet<number>
      /** 'transient' = unsaved working set (dashed ring);
          'saved' = editing a SELECTION's membership (solid ring). */
      variant: 'transient' | 'saved'
      inert?: ReadonlySet<number>
      onToggle: (group: MergeCard<BaseInterpretedDataType>) => void
      onSetMany: (
        groups: MergeCard<EntityRow>[],
        on: boolean
      ) => void
    }
    /** Group ids ringed solid while an idle chip is hovered/focused (peek). */
    previewIds: ReadonlySet<number> | null
    /** Selection-episode key (e.g. the active chip id). Changing it resets
        the shift-range anchor and re-runs the scroll-into-view — a stale
        anchor from the previous episode must never drive a range. */
    episode: unknown
    /** Extra control rendered in the title row next to bulk/sort (e.g. the
        compact scope select). Rendered even when the list is empty. */
    titleExtra?: Snippet
    /** Pinned row rendered inside the grid after the entities (e.g. No AOI). */
    footer?: Snippet
  }

  let {
    groups,
    title,
    emptyMessage,
    columns,
    sortColumns,
    grouped,
    groupNotice,
    lockedNameIds,
    onSort,
    onReorder,
    onRename,
    selection,
    previewIds,
    episode,
    titleExtra,
    footer,
  }: Props = $props()

  const gridTemplate = $derived(columns.map(c => c.width).join(' '))

  // ── Row selection (solid ring + tint on selected cards) ───────────────────
  const isSelected = (id: number) => selection.selected.has(id)
  const isInert = (id: number) => !!selection.inert?.has(id)
  const isPeeked = (id: number) => !!previewIds?.has(id)

  // Pointer guard: toggle only when both the press and the release landed on
  // card surface (not a control), the pointer barely moved, and it is a
  // single click — so drags, text edits, and double-clicks never toggle.
  const INTERACTIVE = 'input, button, label, a, .drag-handle'
  let press: { x: number; y: number; el: HTMLElement } | null = null
  let anchorId: number | null = null // shift-range anchor

  const selectedCount = $derived(selection.selected.size)

  const cardPointerDown = (e: PointerEvent) => {
    press = { x: e.clientX, y: e.clientY, el: e.target as HTMLElement }
  }

  // Shift-click on the card surface means "extend the range", never "extend
  // text selection" — without this the browser highlights every label between
  // the two clicks. Inside a control it stays the control's gesture (shift-
  // selecting text in the name input must keep working).
  const cardMouseDown = (e: MouseEvent) => {
    if (e.shiftKey && !(e.target as HTMLElement).closest(INTERACTIVE)) {
      e.preventDefault()
    }
  }

  const cardClick = (e: MouseEvent, group: MergeCard<BaseInterpretedDataType>) => {
    if (isInert(group.id)) return
    const down = press
    press = null
    if (e.detail > 1) return
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return
    if (!down || down.el.closest(INTERACTIVE)) return
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
    if (e.shiftKey && anchorId !== null && anchorId !== group.id) {
      const vis = groups
      const ai = vis.findIndex(g => g.id === anchorId)
      const bi = vis.findIndex(g => g.id === group.id)
      if (ai !== -1 && bi !== -1) {
        const [lo, hi] = ai < bi ? [ai, bi] : [bi, ai]
        const range = vis.slice(lo, hi + 1).filter(g => !isInert(g.id))
        // Extend the anchor's current state across the visible range.
        selection.onSetMany(range, isSelected(anchorId))
        return
      }
    }
    selection.onToggle(group)
    anchorId = group.id
  }

  // The anchor is only meaningful within one selection episode: reset it when
  // the selection EMPTIES (not when it appears, or the first click's anchor
  // would be wiped and the very first shift-range would silently fail) and
  // whenever the episode changes (a stale anchor from the transient set must
  // not drive a range inside a chip's membership, and vice versa).
  const hasSelection = $derived(selectedCount > 0)
  $effect(() => {
    if (!hasSelection) anchorId = null
  })
  $effect(() => {
    void episode
    anchorId = null
  })

  // A selection appearing from elsewhere (a chip was clicked, far below the
  // fold) brings its first marked card into view — keyed on the episode so
  // switching directly between chips also reveals the new chip's members.
  let gridEl = $state<HTMLElement | null>(null)
  $effect(() => {
    void episode
    if (!hasSelection) return
    gridEl
      ?.querySelector('.entity-card.selected')
      ?.scrollIntoView({ block: 'nearest' })
  })

  // Regroup animation. Renaming a row into (or out of) a group is a
  // destroy-here / create-there in the DOM, so instead of trying to fly the row
  // across containers (which clips and overlaps), we orchestrate it in place:
  // the leaving slot collapses while it fades, and the arriving slot first
  // grows its height, then fades its content in. That reads as one calm hand-off
  // and leads the eye to where the row landed. Sibling rows follow the freed or
  // opened space through plain layout reflow — flip is deliberately off except
  // during a drag (see below), because flip snaps survivors to their final spot
  // while the collapsing row still occupies space, which is what caused the
  // earlier "jumps up and overlaps" glitch.
  const COLLAPSE = 200
  const EXPAND = 300
  const REFLOW = 180
  let ready = $state(false)
  onMount(() => {
    ready = true
  })

  const px = (v: string) => parseFloat(v) || 0

  // Both transitions scale the same box metrics (height/padding/margin/
  // border); they differ only in how `t` maps to (box scale, opacity).
  const boxTransition =
    (map: (t: number) => { box: number; opacity: number }) =>
    (node: Element, { duration }: { duration: number }) => {
      const s = getComputedStyle(node)
      const h = px(s.height)
      const pt = px(s.paddingTop)
      const pb = px(s.paddingBottom)
      const mt = px(s.marginTop)
      const mb = px(s.marginBottom)
      const bt = px(s.borderTopWidth)
      const bb = px(s.borderBottomWidth)
      return {
        duration,
        easing: cubicOut,
        css: (t: number) => {
          const { box, opacity } = map(t)
          return (
            `overflow:hidden;opacity:${opacity};height:${box * h}px;` +
            `padding-top:${box * pt}px;padding-bottom:${box * pb}px;` +
            `margin-top:${box * mt}px;margin-bottom:${box * mb}px;` +
            `border-top-width:${box * bt}px;border-bottom-width:${box * bb}px;`
          )
        },
      }
    }

  // Fade opacity and shrink the box together.
  const collapseFade = boxTransition(t => ({ box: t, opacity: t }))
  // Grow the box height first, then fade the content in over the last stretch.
  const SPLIT = 0.6 // height done by 60%, then opacity fades in
  const expandThenFade = boxTransition(t => ({
    box: Math.min(1, t / SPLIT),
    opacity: Math.max(0, (t - SPLIT) / (1 - SPLIT)),
  }))

  const collapseDur = () => (ready ? COLLAPSE : 0)
  const expandDur = () => (ready ? EXPAND : 0)
  const reflowDur = () => (ready ? REFLOW : 0)

  let dragItemKey: number | null = $state(null)

  // Flip repositions cards only during a drag (a pure reorder: the dragged card
  // is fixed, the others glide aside to make room). It stays OFF for a regroup,
  // where a card is added/removed: there the collapse/expand transitions free or
  // open the space and siblings follow by plain layout reflow. Flip there would
  // snap survivors to their final spot while the leaving card still occupies
  // space — the "jumps up and overlaps" glitch. `dragItemKey` is set on
  // pointer-down (before any reorder), so this reads true synchronously mid-drag.
  const flipDur = (groupId: number) =>
    dragItemKey !== null && dragItemKey !== groupId ? reflowDur() : 0
  let bulkOpen = $state(false)
  let sortOpen = $state(false)

  const bulkItems = $derived.by((): MenuItem[] => [
    createMenuComponentItem<BulkActionsFlyoutProps>({
      label: 'Rename items…',
      value: 'rename',
      icon: Replace,
      component: BulkActionsFlyout,
      // Locked rows are excluded from the flyout's match count — renameAll
      // skips them, so counting them would overstate what Replace does.
      componentProps: {
        items: lockedNameIds?.size
          ? groups
              .map(g => ({
                ...g,
                members: g.members.filter(m => !lockedNameIds.has(m.id)),
              }))
              .filter(g => g.members.length > 0)
          : groups,
        onRename,
      },
      componentWidth: 300,
      componentHeight: 240,
    }),
  ])

  const sortMenuItems = $derived.by((): MenuItem[] =>
    sortColumns.flatMap(col => [
      { label: `${col.label} A–Z`, onAction: () => onSort(col.column, 'asc') },
      { label: `${col.label} Z–A`, onAction: () => onSort(col.column, 'desc') },
    ])
  )

  const dragHandle = createListReorder({
    itemSelector: '.entity-card',
    containerSelector: '.entity-grid',
    onDragStart: key => {
      dragItemKey = key
    },
    onDragEnd: () => {
      dragItemKey = null
    },
    onReorder: (from, to) => onReorder(from, to),
  })
</script>

<!-- data-selection-keep: pointerdowns here must not end the editing episode
     (selectionSession.onOutsideDown). -->
<div class="section-title-row" data-selection-keep>
  <span class="section-title">{title}</span>
  <div class="title-actions">
    {@render titleExtra?.()}
    {#if groups.length > 0}
      <button
        class="tool-button"
        class:active={bulkOpen}
        aria-label="Bulk actions"
        use:tooltipAction={{ content: 'Bulk actions', position: 'bottom', disabled: bulkOpen }}
        use:contextMenuAction={{
          items: bulkItems,
          position: 'bottom',
          horizontalAlign: 'end',
          onOpen: () => { bulkOpen = true },
          onClose: () => { bulkOpen = false },
        }}
      >
        <SlidersHorizontal size={'1em'} />
      </button>
      <button
        class="tool-button"
        class:active={sortOpen}
        aria-label="Sort {title.toLowerCase()}"
        use:tooltipAction={{ content: 'Sort', position: 'bottom', disabled: sortOpen }}
        use:contextMenuAction={{
          items: sortMenuItems,
          position: 'bottom',
          horizontalAlign: 'end',
          onOpen: () => { sortOpen = true },
          onClose: () => { sortOpen = false },
        }}
      >
        <ArrowDownAZ size={'1em'} />
      </button>
    {/if}
  </div>
</div>

{#if groups.length === 0}
  <Empty message={emptyMessage} />
{:else}
  <div
    class="entity-grid"
    data-selection-keep
    bind:this={gridEl}
    style:--grid-columns={gridTemplate}
  >
    <div class="column-labels" style:grid-template-columns={gridTemplate}>
      {#each columns as col}
        {#if col.tooltip}
          <span
            class="has-tip"
            class:center-align={col.align === 'center'}
            use:tooltipAction={{ content: col.tooltip, position: 'bottom' }}
          >
            {col.label}
          </span>
        {:else}
          <span class:center-align={col.align === 'center'}>{col.label}</span>
        {/if}
      {/each}
    </div>

    {#each groups as group (group.id)}
      <!-- Click-to-toggle is a pointer-only enhancement; the keyboard/SR path
           is the visually hidden member-toggle checkbox rendered below. -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="entity-card"
        class:dragging={dragItemKey === group.id}
        class:selecting={!isInert(group.id)}
        class:selected={isSelected(group.id)}
        class:saved-variant={selection.variant === 'saved'}
        class:peeked={isPeeked(group.id) && !isSelected(group.id)}
        onpointerdown={cardPointerDown}
        onmousedown={cardMouseDown}
        onclick={e => cardClick(e, group)}
        animate:flip={{ duration: flipDur(group.id), easing: cubicOut }}
      >
          <!-- Keyboard/SR path: always present while editing a SAVED selection
               (an empty one has no other keyboard way to gain its first
               member); for the transient set only once it exists, so idle
               tab order stays unpolluted. -->
          {#if !isInert(group.id) && (selection.variant === 'saved' || selectedCount > 0)}
            <input
              type="checkbox"
              class="member-toggle"
              checked={isSelected(group.id)}
              onchange={() => selection.onToggle(group)}
              aria-label={`Select ${group.members[0].displayedName || group.members[0].originalName}`}
            />
          {/if}
          {#each group.members as member, i (member.id)}
            {@const isLeader = i === 0}
            <div
              class="entity-row"
              class:member={!isLeader}
              style:grid-template-columns={gridTemplate}
              class:leader={isLeader}
              in:expandThenFade={{ duration: expandDur() }}
              out:collapseFade={{ duration: collapseDur() }}
            >
              {#each columns as col}
                {#if col.type === 'handle'}
                  <div class="col-handle">
                    {#if isLeader}
                      <div class="drag-handle" use:dragHandle={group.id}>
                        <GripVertical size={'1em'} />
                      </div>
                    {/if}
                  </div>
                {:else if col.type === 'readonly'}
                  <div
                    class="col-readonly"
                    class:center-align={col.align === 'center'}
                  >
                    {(member as unknown as Record<string, string>)[col.key ?? '']}
                  </div>
                {:else if col.type === 'text'}
                  <div>
                    {#if lockedNameIds?.has(member.id)}
                      <div
                        class="col-readonly"
                        use:tooltipAction={{ content: 'Reserved name' }}
                      >
                        {member.displayedName}
                      </div>
                    {:else}
                      <InputText
                        label="Displayed name"
                        showLabel={false}
                        fill={true}
                        ariaLabel={`Displayed name for ${member.originalName}`}
                        value={member.displayedName}
                        oninput={e => grouped.onNameInput(member, e.detail, isLeader, group)}
                      />
                    {/if}
                  </div>
                {:else if col.type === 'color' && isLeader}
                  <div class="col-center">
                    <InputColor
                      label="Color"
                      showLabel={false}
                      width={35}
                      ariaLabel={`Color for ${member.originalName}`}
                      value={member.color ?? '#000000'}
                      oninput={event => grouped.onColorInput?.(group, event.detail)}
                    />
                  </div>
                {:else if col.type === 'color' && !isLeader}
                  <div></div>
                {:else if col.type === 'action' && isLeader}
                  <div class="col-action">
                    <button
                      class="row-action"
                      class:set={grouped.rowActionActive?.(member) ?? false}
                      aria-label={`${col.label} for ${member.displayedName || member.originalName}`}
                      use:tooltipAction={{
                        content: grouped.rowActionTooltip?.(member) ?? '',
                        disabled: !grouped.rowActionTooltip,
                      }}
                      onclick={() => grouped.onRowAction?.(member)}
                    >
                      <ImageIcon size={'1em'} />
                    </button>
                  </div>
                {:else if col.type === 'action' && !isLeader}
                  <div></div>
                {/if}
              {/each}
            </div>
          {/each}
          {#if group.members.length > 1}
            {@const notice = groupNotice?.(group)}
            {#if notice}
              <div
                class="group-notice {notice.tone}"
                in:expandThenFade={{ duration: expandDur() }}
                out:collapseFade={{ duration: collapseDur() }}
              >
                <span class="notice-text">{notice.message}</span>
                {#if notice.action}
                  <button class="notice-action" onclick={notice.action.onClick}>
                    {notice.action.label}
                  </button>
                {/if}
              </div>
            {/if}
          {/if}
      </div>
    {/each}

    {@render footer?.()}
  </div>
{/if}

<style>
  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .section-title {
    font-weight: 600;
  }

  .title-actions {
    display: flex;
    gap: var(--spacing-xs);
    align-items: center;
  }

  .tool-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid var(--c-midgrey);
    /* One control metric across the header: same height AND radius as the
       compact Select trigger. */
    border-radius: var(--rounded);
    color: var(--c-darkgrey);
    width: 26px;
    height: 26px;
    cursor: pointer;
    transition: color var(--transition-fast) ease, border-color var(--transition-fast) ease, background-color var(--transition-fast) ease;
  }

  .tool-button:hover {
    color: var(--c-brand);
    border-color: var(--c-brand);
  }

  .tool-button.active {
    color: var(--c-brand);
    border-color: var(--c-brand);
    background-color: color-mix(in srgb, var(--c-brand) 8%, var(--c-white));
  }

  .entity-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(760px, 100%);
    margin-bottom: 20px;
  }

  .column-labels {
    display: grid;
    gap: 8px;
    padding: 0 12px;
    font-size: 10px;
    color: var(--c-midgrey);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .column-labels span:first-child {
    margin-left: -12px;
  }

  .center-align {
    text-align: center;
  }

  .has-tip {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
    cursor: help;
    width: fit-content;
  }

  .entity-card {
    position: relative; /* anchors the membership ring + hidden toggle */
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    overflow: hidden;
    box-shadow: var(--shadow-sm);

    &.dragging {
      opacity: 0.3;
      border-style: dashed;
      border-color: var(--c-midgrey);
      box-shadow: none;
    }
  }

  .entity-row {
    display: grid;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--c-darkwhite);
  }

  .entity-row.member {
    border-top: 1px solid var(--c-border);
    background-color: var(--c-white);
  }

  .group-notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--c-border);
    font-size: 12px;
  }

  .group-notice.info {
    background-color: color-mix(in srgb, var(--c-brand) 6%, var(--c-white));
    color: var(--c-darkgrey);
  }

  .group-notice.warn {
    background-color: color-mix(in srgb, var(--c-danger, #b91c1c) 8%, var(--c-white));
    color: var(--c-danger, #b91c1c);
  }

  .notice-text {
    line-height: 1.3;
  }

  .notice-action {
    flex: 0 0 auto;
    padding: 4px 10px;
    border: 1px solid currentColor;
    border-radius: var(--rounded-md);
    background: none;
    color: inherit;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
  }

  .notice-action:hover {
    background-color: color-mix(in srgb, currentColor 12%, transparent);
  }

  .col-handle {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Selection mode ────────────────────────────────────────────────────── */

  /* Click-to-select is live: the card surface is a button-like target, but
     text editing inside the inputs must stay untouched (inputs keep their own
     selection behavior under user-select: none on the parent). */
  .entity-card.selecting {
    cursor: pointer;
    user-select: none;
  }

  /* Hover teaches the gesture at the moment of intent — the border leans
     toward the selection color where a click would toggle. */
  .entity-card.selecting:hover:not(:has(input:hover, button:hover, .drag-handle:hover)) {
    border-color: color-mix(in srgb, var(--c-info) 40%, var(--c-border));
  }

  /* Keyboard/SR path for the selection: a real checkbox, visually hidden. */
  .member-toggle {
    position: absolute;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
  }

  .entity-card:has(.member-toggle:focus-visible) {
    outline: 2px solid var(--c-brand);
    outline-offset: 2px;
  }

  /* A selected card speaks the tray bubble's language — slight --c-info
     surface and a 1px darker-blue border on the card's own border box, so
     "selection tool" reads instantly. Dashed = temporary working set,
     solid = editing a saved SELECTION. Selection stays inside-blue while
     focus stays outside-red — never the same channel. */
  .entity-card.selected {
    border-color: color-mix(in srgb, var(--c-info) 85%, var(--c-black));
  }

  .entity-card.selected:not(.saved-variant) {
    border-style: dashed;
  }

  /* Faint interior wash so a selected card reads at a glance even in
     peripheral vision. Overlay (not background) because the rows paint
     their own backgrounds over the card. Editing a SAVED selection washes
     heavier so the two modes differ in weight, not just dash pattern. */
  .entity-card.selected::after {
    content: '';
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--c-info) 5%, transparent);
    pointer-events: none;
  }

  .entity-card.selected.saved-variant::after {
    background: color-mix(in srgb, var(--c-info) 8%, transparent);
  }

  /* Chip-hover peek: border tint only, no wash — related, not selected. */
  .entity-card.peeked {
    border-color: color-mix(in srgb, var(--c-info) 60%, var(--c-border));
  }

  .drag-handle {
    cursor: grab;
    color: var(--c-midgrey);
    display: flex;
    align-items: center;
    padding: 2px 0;
    transition: color var(--transition-fast) ease;
  }

  .drag-handle:hover {
    color: var(--c-darkgrey);
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .col-readonly {
    font-size: 14px;
    color: var(--c-midgrey);
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* Original identifiers stay copyable under the card's user-select: none. */
    user-select: text;
  }

  .col-center {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Per-row action button (e.g. stimulus reference media) ─────────────── */

  /* The cell overrides the row's align-items: center so the button shares
     the row's control height (the name input beside it). */
  .col-action {
    align-self: stretch;
    display: flex;
    justify-content: center;
  }

  /* The tool-button vocabulary, sized to the row. State = fill: outline is
     "no media", the primary-button brand fill is "media attached" — so the
     brand-outline hover can't be mistaken for the set state. */
  .row-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    background: none;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    color: var(--c-darkgrey);
    cursor: pointer;
    transition:
      color var(--transition-fast) ease,
      border-color var(--transition-fast) ease,
      background-color var(--transition-fast) ease;
  }

  .row-action:hover {
    color: var(--c-brand);
    border-color: var(--c-brand);
  }

  .row-action.set,
  .row-action.set:hover {
    background-color: var(--c-brand);
    border-color: var(--c-brand);
    color: var(--c-white);
  }

  .row-action.set:hover {
    background-color: var(--c-brand-dark);
  }
</style>
