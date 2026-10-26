<script lang="ts">
  import { untrack } from 'svelte'
  import GridItem from './GridItem.svelte'
  import Button from '$lib/shared/components/Button.svelte'
  import {
    getPlotDisplayName,
    getPlotSubtitle,
  } from '$lib/plots/registry'
  import PlotContainer from '$lib/plots/shared/components/PlotContainer.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { getDebugMessage } from '$lib/errors'
  import { generateUniqueId } from '$lib/shared/uniqueId'
  import { getStimuliOptions } from '$lib/plots/shared'
  import type { AllGridTypes } from '..'
  import type { GridConfig } from './types'
  import {
    commitGridItemDuplication,
    commitGridItemGroupMove,
    commitGridItemRemoval,
    commitGridItemsDuplication,
    commitGridItemsRemoval,
    commitGridItemResize,
    getGridItemCommandSource,
  } from './itemCommands'
  import ActionChip from './ActionChip.svelte'
  import {
    GridInteractionOverlay,
    type GridInteractionController,
  } from './interaction'
  import { responsive } from '../responsive.svelte'
  import { generateSelectionPath, selectionPathCorner } from './selectionPath'
  import { useContextMenu, useContextMenuAction, type MenuItem } from '$lib/context-menu'
  import { exportFiguresModal } from '$lib/modals/definitions'
  import Copy from 'lucide-svelte/icons/copy'
  import Download from 'lucide-svelte/icons/download'
  import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal'
  import X from 'lucide-svelte/icons/x'
  import Table from 'lucide-svelte/icons/table'
  import ArrowDown from 'lucide-svelte/icons/arrow-down'
  import ArrowUp from 'lucide-svelte/icons/arrow-up'
  import Scan from 'lucide-svelte/icons/scan'
  import { gridBoundsOf } from './pixels'
  import type { WorkspaceCamera } from '../camera.svelte'
  import { plotDataExport } from '../pane/dataExport'
  import ClipboardCopy from 'lucide-svelte/icons/clipboard-copy'
  import type { PlotView } from '$lib/plots/definePlot'
  import {
    canCopyImages,
    copyCanvasToClipboard,
  } from '$lib/plots/shared/figureExport'
  import FigureRenderHost from '$lib/modals/export/export-figures/FigureRenderHost.svelte'
  import type { PlotExportProps } from '$lib/modals/export/export-figures/types'
  import {
    deriveItemView,
    itemExportProps,
  } from '$lib/modals/export/export-figures/view'
  import { DEFAULT_CANVAS_EXPORT_MARGIN } from '$lib/modals/export/shared/helpers'

  const contextMenuState = useContextMenu()
  const contextMenuAction = useContextMenuAction()
  import {
    DELETE_KEY_LABEL,
    isTextEntryTarget,
    resolveWorkspaceShortcut,
    shortcutLabel,
  } from '../keys'

  const { engine, errorService, workspace, grid, modalState, toastState } =
    getGazePlotterSession()

  let gridEl = $state<HTMLDivElement>()

  // One grid cell per press: the keyboard's way to move what a drag moves.
  const ARROW_STEPS: Record<string, [dx: number, dy: number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }

  // Mac's main "delete" key emits Backspace, so we handle both.
  // Capture on `document`, like selectionSession's Esc unwinding: the modal and
  // the context menu bubble on `window` and clear the state this guard reads,
  // so phase must decide who reads first, never registration order.
  $effect(() => {
    function onKeydown(event: KeyboardEvent) {
      const shortcut = resolveWorkspaceShortcut(event)
      const duplicate = shortcut === 'duplicate'
      const selectAll = shortcut === 'select-all'
      const stimulusStep =
        shortcut === 'next-stimulus' ? 1 : shortcut === 'previous-stimulus' ? -1 : 0
      const chord = event.metaKey || event.ctrlKey || event.altKey
      if (chord && !duplicate && !selectAll && !stimulusStep) return
      if (isTextEntryTarget(event)) return
      // A surface in front owns the key: one Escape dismisses one surface, and
      // Delete never removes a plot the user cannot see.
      if (modalState.activeModal || contextMenuState.current) return
      // Only from the page or the grid: a focused pane or rail control owns the key.
      const target = event.target as Node | null
      const fromPageOrGrid = target === document.body || !!gridEl?.contains(target)
      if (selectAll) {
        if (!fromPageOrGrid) return
        event.preventDefault()
        grid.setSelection(gridItems.map(item => item.id))
        return
      }
      // Operate on the whole selection (single = a set of one). Reading the
      // set directly — not the single-only `selectedItemId` getter — keeps
      // Delete/Escape working for a multi-selection.
      const selectedIds = grid.selectedItemIds
      if (selectedIds.length === 0) return
      // Also from the pane: no control there claims Alt+Up/Down, and the
      // step is most wanted right after editing the plot's settings.
      if (stimulusStep) {
        event.preventDefault()
        stepStimulus(stimulusStep)
        return
      }
      const step = ARROW_STEPS[event.key]
      if (step) {
        if (!fromPageOrGrid) return
        event.preventDefault()
        const [dx, dy] = step
        commitGridItemGroupMove(
          workspace,
          gridItems,
          grid.selectedItems.map(item => ({ id: item.id, x: item.x + dx, y: item.y + dy }))
        )
        return
      }
      if (duplicate || event.key === 'Delete' || event.key === 'Backspace') {
        if (!fromPageOrGrid) return
        event.preventDefault()
        if (duplicate) {
          if (selectedIds.length === 1) handleDuplicate({ id: selectedIds[0] })
          else handleGroupDuplicate()
          return
        }
        // Snapshot first: removeItem mutates the selection set as it goes.
        commitGridItemsRemoval(workspace, gridItems, [...selectedIds])
        return
      }
      if (event.key === 'Escape') {
        // The Pane owns Escape while it is up, for both cardinalities: on
        // mobile it closes the sheet and KEEPS the selection so the Edit FAB
        // returns, and its bulk close clears the selection itself.
        if (grid.paneOpenId !== null || grid.selectedCount > 1) return
        event.preventDefault()
        grid.clearSelection()
      }
    }
    document.addEventListener('keydown', onKeydown, { capture: true })
    return () =>
      document.removeEventListener('keydown', onKeydown, { capture: true })
  })

  interface Props {
    gridItems: AllGridTypes[]
    /** The plots land one after another (after a load), not all at once. */
    entrance?: boolean
    gridConfig: GridConfig
    gridHeight: number
    gridWidth: number
    gridIsEmpty: boolean
    interaction: GridInteractionController
    camera: WorkspaceCamera
  }

  const {
    gridItems,
    entrance = false,
    gridConfig,
    gridHeight,
    gridWidth,
    gridIsEmpty,
    interaction,
    camera,
  }: Props = $props()

  // Entrance delays in reading order, fixed at mount: the camera pulls back
  // first, then the plots land within ENTRANCE_SPREAD_MS whatever their count.
  // Plots added later are not in the map and keep their own fade.
  const ENTRANCE_START_MS = 350
  const ENTRANCE_STEP_MS = 40
  const ENTRANCE_SPREAD_MS = 400
  const entranceDelays = untrack(() => {
    const delays = new Map<number, number>()
    if (!entrance) return delays
    const order = [...gridItems].sort((a, b) => a.y - b.y || a.x - b.x)
    const step =
      order.length > 1
        ? Math.min(ENTRANCE_STEP_MS, ENTRANCE_SPREAD_MS / (order.length - 1))
        : 0
    order.forEach((item, rank) =>
      delays.set(item.id, ENTRANCE_START_MS + rank * step)
    )
    return delays
  })

  // The contour drawn around a multi-selection: how far outside the plots it
  // runs, and how round its corners are. The chip hangs off the same numbers.
  const SELECTION_CONTOUR_MARGIN = 6
  const SELECTION_CONTOUR_RADIUS = 26

  const selectionPath = $derived(
    generateSelectionPath(
      grid.selectedItems,
      gridConfig,
      SELECTION_CONTOUR_MARGIN,
      SELECTION_CONTOUR_RADIUS
    )
  )

  // Where the group's chip hangs: the contour's top-left corner, so the chip
  // floats above the outline with their left edges on one line.
  const groupChipAnchor = $derived(
    selectionPathCorner(
      grid.selectedItems,
      gridConfig,
      SELECTION_CONTOUR_MARGIN
    )
  )

  // The group's verbs show when the group's outline does, and never while a
  // selection rectangle is still gathering plots (see GridItem's isSettled).
  const showsGroupActions = $derived(
    grid.selectedCount > 1 &&
      !interaction.isTransforming &&
      interaction.mode !== 'selecting'
  )

  // Each selected plot moves to its own next stimulus in the picker's order,
  // wrapping at the ends; plots without a stimulus (Metric Matrix) stay put.
  function stepStimulus(direction: 1 | -1, items = grid.selectedItems): void {
    const order = getStimuliOptions(engine).map(option => Number(option.value))
    if (items.length === 0) return
    // A shortcut that cannot act says why, instead of nothing.
    if (order.length < 2) {
      toastState.addInfo('This dataset has one stimulus, so there is no other to show.')
      return
    }
    workspace.updateEachItemSettings(
      items.map(item => item.id),
      settings => {
        const current = (settings as { stimulusId?: number }).stimulusId
        if (current === undefined) return null
        const index = order.indexOf(current)
        const next = (index + direction + order.length) % order.length
        return { stimulusId: order[index === -1 ? 0 : next] }
      },
      getGridItemCommandSource(items[0])
    )
  }

  // The whole selection duplicates in one step, and the copies become the
  // selection, exactly as a single duplication hands over to its copy.
  function handleGroupDuplicate(): void {
    const commits = grid.selectedItems.map(item => ({
      id: item.id,
      duplicateId: generateUniqueId(),
    }))
    if (commitGridItemsDuplication(workspace, gridItems, commits)) {
      grid.setSelection(commits.map(commit => commit.duplicateId))
    }
  }

  function handleGroupRemove(): void {
    commitGridItemsRemoval(workspace, gridItems, [...grid.selectedItemIds])
  }

  // Duplicate commits immediately. The store's findOptimalPosition
  // places the copy adjacent-right of the source (falling back to
  // below, then any free cell), so the user sees the new item land
  // near the one they acted on.
  function handleDuplicate(event: { id: number }): void {
    const newId = generateUniqueId()
    if (
      commitGridItemDuplication(workspace, gridItems, {
        id: event.id,
        duplicateId: newId,
      })
    ) {
      grid.selectOnly(newId)
      if (!responsive.isMobile) {
        grid.openPane(newId)
      }
    }
  }

  // Copy plot: the figure export's off-screen render at twice screen
  // resolution, onto the clipboard.
  const COPY_DPI = 192
  let copyJob = $state.raw<{
    view: PlotView
    exportProps: PlotExportProps
    resolve: (canvas: HTMLCanvasElement | null) => void
  } | null>(null)

  function copyPlot(item: AllGridTypes): void {
    if (copyJob) return
    const name = getPlotDisplayName(item.type)
    const view = deriveItemView(engine, item)
    const canvas = new Promise<HTMLCanvasElement | null>(resolve => {
      if (!view) return resolve(null)
      copyJob = {
        view,
        exportProps: itemExportProps(item, grid, COPY_DPI, DEFAULT_CANVAS_EXPORT_MARGIN),
        resolve: result => {
          copyJob = null
          resolve(result)
        },
      }
    })
    copyCanvasToClipboard(canvas).then(
      () => toastState.addSuccess(`${name} copied to the clipboard`),
      error =>
        errorService.report({
          origin: 'export',
          severity: 'recoverable',
          userMessage: `Could not copy ${name} to the clipboard.`,
          cause: error,
          context: { itemId: item.id, plotType: item.type },
        })
    )
  }

  // Right-click on a plot: its verbs at the pointer, without changing the
  // selection (on desktop a selection opens the pane). A member of a
  // multi-selection acts for the whole selection, as its drag does.
  function isGroupMember(id: number): boolean {
    return grid.selectedCount > 1 && grid.selectedItemIds.includes(id)
  }

  function plotMenuItems(id: number): MenuItem[] {
    const group = isGroupMember(id)
    const ids = group ? [...grid.selectedItemIds] : [id]
    const noun = group ? `${ids.length} plots` : 'plot'
    const targets = () => gridItems.filter(i => ids.includes(i.id))
    const item = group ? undefined : gridItems.find(i => i.id === id)
    const data = item && plotDataExport(item.settings, engine, modalState)
    const steps =
      getStimuliOptions(engine).length > 1 &&
      gridItems.some(i => ids.includes(i.id) && 'stimulusId' in i.settings)
    const divider = { isDivider: true as const }
    // Shortcuts act on the selection, so they are hinted only when the
    // menu's target is the selection.
    const isSelection = group || grid.selectedItemId === id
    const hint = (label: string) => (isSelection ? label : undefined)
    // Grouped: view, change, export, remove.
    return [
      // A pane already showing this plot needs no Settings item.
      ...(group || grid.paneOpenId === id
        ? []
        : [
            {
              label: 'Settings',
              icon: SlidersHorizontal,
              onAction: () => {
                grid.selectOnly(id)
                grid.openPane(id)
              },
            },
          ]),
      {
        label: `Zoom to ${noun}`,
        icon: Scan,
        onAction: () => camera.fit(gridBoundsOf(targets(), gridConfig)),
      },
      divider,
      {
        label: `Duplicate ${noun}`,
        shortcut: hint(shortcutLabel('duplicate')),
        icon: Copy,
        onAction: () => (group ? handleGroupDuplicate() : handleDuplicate({ id })),
      },
      ...(steps
        ? [
            {
              label: 'Next stimulus',
              shortcut: hint(shortcutLabel('next-stimulus')),
              icon: ArrowDown,
              onAction: () => stepStimulus(1, targets()),
            },
            {
              label: 'Previous stimulus',
              shortcut: hint(shortcutLabel('previous-stimulus')),
              icon: ArrowUp,
              onAction: () => stepStimulus(-1, targets()),
            },
          ]
        : []),
      divider,
      // The clipboard holds one image, so a group has no Copy item.
      ...(item && canCopyImages()
        ? [{ label: 'Copy plot', icon: ClipboardCopy, onAction: () => copyPlot(item) }]
        : []),
      {
        label: `Download ${noun}`,
        icon: Download,
        onAction: () => modalState.open(exportFiguresModal, { itemIds: ids }),
      },
      ...(data
        ? [{ label: data.label, detail: data.summary, icon: Table, onAction: data.open }]
        : []),
      divider,
      {
        label: `Remove ${noun}`,
        shortcut: hint(DELETE_KEY_LABEL),
        icon: X,
        onAction: () => commitGridItemsRemoval(workspace, gridItems, ids),
      },
    ]
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
</script>

<div
  bind:this={gridEl}
  class="grid-container"
  class:is-interacting={interaction.isInteracting}
  class:is-panning={interaction.isPanning}
  style="width: {gridWidth}px; height: {gridHeight}px;"
  role="application"
>
  {#if !gridIsEmpty}
    {#each gridItems as item (item.id)}
      {@const plotLabel = getPlotDisplayName(item.type)}
      {@const plotSubtitle = getPlotSubtitle(item, engine)}
      <!-- No wrapper transition here: GridItem's root `.grid-item`
           already fades (150ms). An outer `transition:fade` would wrap
           the component in an opacity<1 stacking context with z-index
           auto, which paints below neighbors' `.grid-item { z-index: 1 }`
           — causing a freshly-duplicated item's action chip to sit
           behind the item above it until the fade completes and the
           stacking context dissolves. -->
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
          enterDelay={entranceDelays.get(item.id)}
          {interaction}
          title={plotLabel}
          subtitle={plotSubtitle}
          onmove={event => commitGridItemGroupMove(workspace, gridItems, event)}
          onresize={event =>
            commitGridItemResize(workspace, gridItems, gridConfig, event)}
          onremove={event => commitGridItemRemoval(workspace, gridItems, event)}
          onduplicate={handleDuplicate}
          menuItems={plotMenuItems(item.id)}
        >
          {#snippet body()}
            <div class="grid-item-content">
              <svelte:boundary
                onerror={error => reportPlotRenderError(item, plotLabel, error)}
              >
                <PlotContainer {item} />

                {#snippet failed(error, reset)}
                  <div class="plot-error-state">
                    <p class="plot-error-copy">
                      {plotLabel} could not be displayed. The rest of the workspace
                      is still available.
                    </p>
                    <p class="plot-error-detail">
                      {getDebugMessage(error, 'Unknown rendering error')}
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onclick={() => reset()}
                    >
                      Retry plot
                    </Button>
                  </div>
                {/snippet}
              </svelte:boundary>
            </div>
          {/snippet}
        </GridItem>
    {/each}
  {/if}

  {#if grid.selectedItemIds.length > 1 && !interaction.isTransforming && selectionPath}
    <svg class="group-selection-svg" aria-hidden="true">
      <path d={selectionPath} class="group-selection-path" />
    </svg>
  {/if}

  {#if showsGroupActions && groupChipAnchor}
    <div
      class="group-chip-anchor"
      style:left="{groupChipAnchor.x}px"
      style:top="{groupChipAnchor.y}px"
      use:contextMenuAction={{
        trigger: 'pointer',
        items: plotMenuItems(grid.selectedItemIds[0]),
      }}
    >
      <ActionChip
        scope="{grid.selectedCount} plots"
        onDuplicate={handleGroupDuplicate}
        onRemove={handleGroupRemove}
      />
    </div>
  {/if}

  <GridInteractionOverlay
    previews={interaction.previewRects}
    {gridConfig}
    mode={interaction.mode}
  />

  {#if interaction.marqueeBounds}
    {@const bounds = interaction.marqueeBounds}
    <div
      class="marquee"
      style:transform="translate({bounds.left}px, {bounds.top}px)"
      style:width="{bounds.right - bounds.left}px"
      style:height="{bounds.bottom - bounds.top}px"
      aria-hidden="true"
    ></div>
  {/if}
</div>

{#if copyJob}
  <FigureRenderHost
    view={copyJob.view}
    exportProps={copyJob.exportProps}
    onResult={copyJob.resolve}
  />
{/if}


<style>
  .grid-container.is-interacting {
    pointer-events: none;
  }

  .grid-container.is-panning {
    cursor: grabbing;
  }

  .grid-container {
    position: relative;
  }

  /* Where the group's action chip hangs, on the contour's top edge. */
  .group-chip-anchor {
    position: absolute;
    z-index: 7;
  }

  /* The selection rectangle being dragged across the desk. Grid-space, like
     every other overlay here: it is anchored to the plots it is drawn
     around, not to the screen. */
  .marquee {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 50;
    pointer-events: none;
    box-sizing: border-box;
    border: 1px solid var(--c-info);
    background: color-mix(in srgb, var(--c-info) 8%, transparent);
  }

  /* Contour outline and fill around a multi-selection. Sits above unselected
     items (z-index 1) and below the interaction overlay (z-index 50);
     purely decorative, so it never intercepts pointer events (dragging
     any member frame moves the group). */
  .group-selection-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 6;
    pointer-events: none;
    overflow: visible;
  }

  .group-selection-path {
    fill: color-mix(in srgb, var(--c-info) 5%, transparent);
    stroke: var(--c-info);
    stroke-width: 2px;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .plot-error-state {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 8px;
    padding: 0;
  }

  .plot-error-copy,
  .plot-error-detail {
    margin: 0;
    color: var(--c-black);
    line-height: var(--leading-normal);
    font-size: var(--text-lg);
  }

  .plot-error-detail {
    color: var(--c-darkgrey);
    overflow-wrap: anywhere;
  }
</style>
