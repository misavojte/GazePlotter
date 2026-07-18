<script lang="ts">
  /**
   * The sticky bottom dock of the entity modals — two rows, constant height,
   * with a real top edge so long lists visibly scroll away underneath it:
   *
   *  - STATUS ROW: idle → a muted gesture hint; rows selected → the info
   *    bubble ("n selected · Select all · Clear · Merge into X · Split");
   *    a chip active → the same bubble carrying "Editing" + rename, count,
   *    the bulk verbs, delete and ✓ Done. All selection options live HERE.
   *  - CHIPS ROW: one static chip per saved SELECTION plus "+ New" (which
   *    reads "Save as selection" while a transient set exists). The active
   *    chip only highlights — it never morphs or moves. A chip clicked while
   *    a transient set exists opens a menu: Edit / Add n / Remove n.
   */
  import Plus from 'lucide-svelte/icons/plus'
  import { contextMenuAction, type MenuItem } from '$lib/context-menu'
  import { tooltipAction } from '$lib/tooltip'
  import type { SelectionSessionApi } from './selectionSession.svelte'

  interface Chip {
    id: number
    name: string
    count: number
    /** Muted note in the bubble while this chip is active (e.g. "3 elsewhere"). */
    hint?: string
    /** Tooltip on chips (e.g. "6 AOIs across all stimuli"). */
    title?: string
    /** Chip-menu verb availability against the transient selection. */
    addable?: boolean
    removable?: boolean
  }

  interface Props {
    /** The shared selection mechanics — owns state, verbs, and unwinding. */
    session: SelectionSessionApi
    /** null = no saved selections for this entity (transient verbs only). */
    chips: Chip[] | null
    /** Plural entity noun for tooltips and labels, e.g. "AOIs". */
    noun?: string
    /** Muted gesture hint shown while nothing is selected. */
    idleHint?: string
    /** One-line explainer under the dock (first run only). */
    helpText?: string
  }

  let {
    session,
    chips,
    noun = 'rows',
    idleHint = 'Click rows to select · Shift-click for a range · Esc clears',
    helpText,
  }: Props = $props()

  const activeChip = $derived(
    chips?.find(c => c.id === session.editingId) ?? null
  )
  const transient = $derived(
    session.editingId === null && session.selectedCount > 0
  )
  // Which chip's fold-in menu is open (drives aria-expanded on its trigger).
  let openMenuChipId = $state<number | null>(null)

  const truncate = (s: string, n = 14) =>
    s.length > n ? s.slice(0, n - 1) + '…' : s

  // With a temporary selection in hand, a chip click offers to fold it into
  // that SELECTION. "Edit selection" leads (it is what a plain click means),
  // and the mutating verbs sit below the divider, disabled when they would
  // be no-ops.
  const chipMenu = (chip: Chip): MenuItem[] => [
    { label: 'Edit selection', onAction: () => session.openSelection(chip.id) },
    { isDivider: true },
    {
      label: `Add ${session.selectedCount} selected`,
      disabled: chip.addable === false,
      onAction: () => session.addSelectedTo(chip.id),
    },
    {
      label: `Remove ${session.selectedCount} selected`,
      disabled: chip.removable === false,
      onAction: () => session.removeSelectedFrom(chip.id),
    },
  ]

  // Size the rename input ONCE per mount (a per-keystroke width would make
  // the verbs beside it wiggle while typing), and focus it without yanking
  // the scroll position — the list above is where the user is about to click.
  const setupName = (node: HTMLInputElement, autofocus: boolean) => {
    const len = Math.min(Math.max(node.value.length, 6), 24)
    node.style.width = `${len}ch`
    if (autofocus) {
      node.focus({ preventScroll: true })
      node.select()
    }
  }

  // Esc inside the rename input behaves like a text field first: blur and
  // consume, so neither the editing layer nor the modal unwinds mid-typing.
  const nameKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') session.done()
    else if (e.key === 'Escape') {
      e.stopPropagation()
      ;(e.currentTarget as HTMLInputElement).blur()
    }
  }
</script>

<svelte:window
  onkeydowncapture={session.onEscCapture}
  onpointerdowncapture={session.onOutsideDown}
/>

<div class="tray">
  <div class="panel">
  <div class="status">
    {#if activeChip}
      <span class="status-line" role="group" aria-label={`Editing selection ${activeChip.name}`}>
        <span class="bubble-kicker">Editing</span>
        <!-- Keyed: switching chips (incl. "+ New" while editing) must remount
             the input so the focus action re-runs for the new selection. -->
        {#key activeChip.id}
          <input
            class="bubble-input"
            value={activeChip.name}
            aria-label="Selection name"
            use:setupName={session.nameFocusPending}
            oninput={e =>
              session.updateSelection(activeChip.id, { name: e.currentTarget.value })}
            onkeydown={nameKeydown}
          />
        {/key}
        <span
          class="bubble-count"
          use:tooltipAction={{ content: `${activeChip.count} members` }}
        >
          ({activeChip.count})
        </span>
        {#if activeChip.hint}
          <span
            class="bubble-hint"
            use:tooltipAction={{
              content: 'Members on stimuli outside the current scope',
            }}
          >
            · {activeChip.hint}
          </span>
        {/if}
        <span class="bubble-sep"></span>
        <button
          class="bubble-verb"
          disabled={session.allVisibleSelected}
          onclick={() => session.selectVisible()}
        >
          Select all ({session.visibleCount})
        </button>
        <button class="bubble-verb" onclick={() => session.clearVisible()}>
          Deselect all
        </button>
        <span class="bubble-sep"></span>
        <button
          class="bubble-verb"
          use:tooltipAction={{
            content: `Removes this selection. The ${noun} themselves stay untouched.`,
          }}
          onclick={() => session.removeSelection(activeChip.id)}
        >
          Dissolve selection
        </button>
      </span>
    {:else if transient}
      <span class="status-line" role="group" aria-label="Selected rows">
        <span class="bubble-count strong">{session.selectedCount} selected</span>
        <span class="bubble-sep"></span>
        <button
          class="bubble-verb"
          disabled={session.allVisibleSelected}
          onclick={() => session.selectVisible()}
        >
          Select all ({session.visibleCount})
        </button>
        <button class="bubble-verb" onclick={() => session.clearVisible()}>
          Clear
        </button>
        <span class="bubble-sep"></span>
        <!-- The disabled button can't receive pointer events, so the
             explanation lives on the wrapper (and adapts to the state). -->
        <span
          use:tooltipAction={{
            content: session.canMerge
              ? `The selected ${noun} become one entity named “${session.mergeTargetName ?? ''}”. Reversible with Split.`
              : `Select at least 2 ${noun} to merge them into one`,
          }}
        >
          <button
            class="bubble-verb"
            disabled={!session.canMerge}
            onclick={() => session.mergeSelected()}
          >
            Merge{session.mergeTargetName
              ? ` into “${truncate(session.mergeTargetName)}”`
              : ''}
          </button>
        </span>
        {#if session.canSplit}
          <button
            class="bubble-verb"
            use:tooltipAction={{
              content: `Splits the selected merged ${noun} back to their original names`,
            }}
            onclick={() => session.splitSelected()}
          >
            Split
          </button>
        {/if}
      </span>
    {:else if idleHint}
      <span class="idle-hint">{idleHint}</span>
    {/if}
  </div>

  {#if chips}
  <div class="chips-row" role="group" aria-label="Selections">
    <span class="tray-label">Selections</span>
    <!-- ONE button per chip whatever the state — flipping in and out of the
         transient mode must not remount the node under focus. The fold-in
         menu is armed via the action's disabled flag instead. -->
    {#each chips as chip (chip.id)}
      <button
        class="chip"
        class:active={chip.id === session.editingId}
        use:tooltipAction={{
          content: chip.title ?? '',
          disabled: !chip.title || openMenuChipId === chip.id,
          // The chips are the bubble's bottom row: opening upward would
          // cover the status line they sit under.
          position: 'bottom',
        }}
        aria-label={`${chip.name}, ${chip.count} members`}
        aria-haspopup={transient ? 'menu' : undefined}
        aria-expanded={transient
          ? openMenuChipId === chip.id
          : chip.id === session.editingId}
        use:contextMenuAction={{
          items: chipMenu(chip),
          position: 'top',
          horizontalAlign: 'start',
          disabled: !transient,
          onOpen: () => (openMenuChipId = chip.id),
          onClose: () => (openMenuChipId = null),
        }}
        onclick={() => {
          if (transient) return
          if (chip.id === session.editingId) session.done()
          else session.openSelection(chip.id)
        }}
        onpointerenter={() => session.setHovered(chip.id)}
        onpointerleave={() => session.setHovered(null)}
        onfocus={() => session.setHovered(chip.id)}
        onblur={() => session.setHovered(null)}
      >
        <span class="chip-name">{chip.name}</span>
        <span class="chip-count">({chip.count})</span>
      </button>
    {/each}
    <button
      class="chip new"
      use:tooltipAction={{
        content: transient
          ? `Saves the selected ${noun} as a named selection plots can focus on`
          : `Creates an empty selection; click ${noun} to include them`,
        position: 'bottom',
      }}
      onclick={() => session.newOrSave()}
    >
      <Plus size={'1em'} />
      <span>{transient ? 'Save as selection' : 'New'}</span>
    </button>
  </div>
  {/if}

  {#if helpText}
    <p class="tray-help">{helpText}</p>
  {/if}
  </div>
</div>

<style>
  /* The floating bubble IS the whole chrome now — no bar behind it. It
     sticks 8px above the modal's visible bottom (the body has 1.25rem
     bottom padding, hence the -12px offset) and the opaque tinted surface
     lets cards scroll cleanly behind the surrounding gaps. */
  .tray {
    position: sticky;
    bottom: -12px;
    z-index: 2;
    width: min(760px, 100%);
    margin-top: 8px;
  }

  /* THE bubble: the whole floating selection info sits on one info-tinted
     rounded surface, so the area reads as the selection tool at a glance. */
  .panel {
    border: 1px solid color-mix(in srgb, var(--c-info) 40%, var(--c-border));
    border-radius: var(--rounded-md);
    background-color: color-mix(in srgb, var(--c-info) 6%, var(--c-white));
    padding: 8px 10px;
  }

  /* Constant-height slot: status line, hint, or nothing — chips never move. */
  .status {
    display: flex;
    align-items: center;
    min-height: 26px;
    margin-bottom: 4px;
  }

  .status-line {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap; /* verbs never overflow the bubble on narrow widths */
    gap: 6px;
    width: 100%;
    font-size: 12px;
  }

  .idle-hint {
    font-size: 12px;
    color: var(--c-darkgrey);
  }

  .bubble-kicker {
    color: var(--c-info);
    font-weight: 600;
  }

  /* Bracketed and visually distinct from the name it counts. */
  .bubble-count {
    color: var(--c-darkgrey);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .bubble-count.strong {
    color: var(--c-info);
    font-weight: 600;
    font-size: 12px; /* a status label, not a bracketed count */
  }

  .bubble-hint {
    color: var(--c-darkgrey);
    white-space: nowrap;
  }

  .bubble-sep {
    width: 1px;
    height: 16px;
    background: color-mix(in srgb, var(--c-info) 30%, transparent);
    flex: 0 0 auto;
  }

  /* Inline-edit affordance: an always-present underline says "type here";
     it firms up on hover and commits to solid info on focus. Constant 1px
     so nothing shifts between states. */
  .bubble-input {
    border: none;
    border-bottom: 1px dashed color-mix(in srgb, var(--c-info) 45%, transparent);
    background: transparent;
    font: inherit;
    font-weight: 600;
    color: var(--c-text);
    padding: 0;
    outline: none;
    min-width: 4ch;
    max-width: 160px;
    transition: border-color var(--transition-fast) ease;
  }

  .bubble-input:hover {
    border-bottom-color: color-mix(in srgb, var(--c-info) 70%, transparent);
  }

  .bubble-input:focus {
    border-bottom: 1px solid var(--c-info);
  }

  .bubble-verb {
    appearance: none;
    border: none;
    background: none;
    color: var(--c-info);
    font-size: 12px;
    font-weight: 500;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--rounded);
    cursor: pointer;
    white-space: nowrap;
    transition: background-color var(--transition-fast) ease;
  }

  .bubble-verb:hover:not(:disabled) {
    background-color: color-mix(in srgb, var(--c-info) 12%, transparent);
  }

  .bubble-verb:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* Keyboard focus matches the app's field convention (Select trigger). */
  .bubble-verb:focus-visible,
  .chip:focus-visible {
    outline: 2px solid var(--c-brand);
    outline-offset: 2px;
  }

  .chips-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tray-label {
    font-size: 12px;
    color: var(--c-darkgrey);
    margin-right: 2px;
  }

  .chip {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 10px;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    background: var(--c-white);
    color: var(--c-text);
    font-size: 12px;
    cursor: pointer;
    max-width: 260px;
    transition:
      border-color var(--transition-fast) ease,
      color var(--transition-fast) ease,
      background-color var(--transition-fast) ease;
  }

  .chip:hover {
    border-color: var(--c-info);
    color: var(--c-info);
  }

  .chip.active {
    border-color: var(--c-info);
    color: var(--c-info);
    background-color: color-mix(in srgb, var(--c-info) 8%, var(--c-white));
  }

  .chip-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip-count {
    color: var(--c-darkgrey);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .chip.active .chip-count {
    color: inherit;
  }

  .chip.new {
    border-style: dashed;
    color: var(--c-darkgrey);
  }

  .chip.new:hover {
    border-color: var(--c-info);
    color: var(--c-info);
  }

  .tray-help {
    margin: 6px 0 0;
    font-size: 12px; /* matches the "Selections" label */
    line-height: 1.4;
    color: var(--c-darkgrey);
  }
</style>
