<script lang="ts">
  import Plus from 'lucide-svelte/icons/plus'
  import Minus from 'lucide-svelte/icons/minus'
  import Scan from 'lucide-svelte/icons/scan'
  import X from 'lucide-svelte/icons/x'
  import { getGazePlotterSession } from '$lib/session'
  import { plotRegistry } from '$lib/plots/registry'
  import { generateUniqueId } from '$lib/shared/uniqueId'
  import type { PlotType } from '$lib/workspace'
  import { responsive } from '../responsive.svelte'
  import type { WorkspaceCamera } from '../camera.svelte'
  import { ZOOM_MAX, ZOOM_MIN } from '../camera.svelte'
  import { createEditPlotControl, createToolControls } from './config'
  import ControlButton from './ControlButton.svelte'
  import { withShortcut } from '../keys'

  /**
   * The workspace rail: a narrow white column docked on the left of the
   * field (a strip along the bottom on phones), in two groups: adding a
   * plot and history at the start, zoom at the end.
   */
  interface Props {
    camera: WorkspaceCamera
  }

  const { camera }: Props = $props()
  const { ingest, engine, workspace, grid } = getGazePlotterSession()

  const isProcessing = $derived(ingest.isLoading)
  const isValidData = $derived(engine.hasValidData)
  const inactive = $derived(isProcessing || !isValidData)

  // Plots the current dataset can feed, grouped for the Add Visualization menu.
  const visualizations = $derived(
    (Object.keys(plotRegistry) as PlotType[])
      .filter(id => engine.hasCapabilities(plotRegistry[id].requireCapabilities))
      .map(id => ({
        id,
        label: plotRegistry[id].name,
        group: plotRegistry[id].group,
      }))
  )

  // Adding selects the new plot; on desktop that also opens its pane.
  function handleAddVisualization(vizType: PlotType) {
    const newId = generateUniqueId()
    if (workspace.addGridItem(vizType, 'controls', newId)) {
      grid.selectOnly(newId)
      if (!responsive.isMobile) grid.openPane(newId)
    }
  }

  const tools = $derived.by(() => {
    const byId = Object.fromEntries(
      createToolControls({
        undoLabel: workspace.lastUndoLabel,
        redoLabel: workspace.lastRedoLabel,
        canUndo: workspace.canUndo,
        canRedo: workspace.canRedo,
        isProcessing,
        isValidData,
        visualizations,
        onUndo: () => workspace.undo(),
        onRedo: () => workspace.redo(),
        onAddVisualization: handleAddVisualization,
      }).map(control => [control.id, control])
    )
    return {
      add: byId['add-visualization'],
      history: [byId['undo'], byId['redo']],
    }
  })

  // Mobile: a selected plot whose settings sheet is closed gets a floating
  // Edit / Deselect pair (desktop opens the pane on selection instead).
  const showPlotControls = $derived(
    responsive.isMobile && grid.selectedItemId !== null && grid.paneOpenId === null
  )
  const editControl = $derived(
    createEditPlotControl(() => {
      if (grid.selectedItemId !== null) grid.openPane(grid.selectedItemId)
    })
  )

  const zoomPercent = $derived(`${Math.round(camera.zoom * 100)}%`)

  const isMobile = $derived(responsive.isMobile)
  // Tooltips and menus open away from the rail, into the field.
  const side = $derived(isMobile ? 'top' : 'right')
</script>

<div
  class="rail"
  class:horizontal={isMobile}
  aria-label="Workspace controls"
  role="toolbar"
  aria-orientation={isMobile ? 'horizontal' : 'vertical'}
>
  {#if showPlotControls}
    <!-- Mobile, a plot selected with its sheet closed: the strip swaps to
         the two actions that matter then. -->
    <div class="group">
      <ControlButton
        label={editControl.label}
        icon={editControl.icon}
        actions={editControl.actions}
        side={side}
        showLabel
      />
      <ControlButton
        label="Deselect"
        icon={X}
        actions={[{ label: 'Deselect', run: () => grid.clearSelection() }]}
        side={side}
        showLabel
      />
    </div>
  {:else}
    <div class="group">
      <ControlButton
        label={tools.add.label}
        icon={tools.add.icon}
        actions={tools.add.actions}
        disabled={tools.add.disabled}
        {side}
      />
      <span class="divider" aria-hidden="true"></span>
      {#each tools.history as control (control.id)}
        <ControlButton
          label={control.label}
          icon={control.icon}
          actions={control.actions}
          disabled={control.disabled}
          {side}
        />
      {/each}
    </div>

    <div class="group zoom">
      <ControlButton
        label={withShortcut('Zoom to fit', 'zoom-fit')}
        icon={Scan}
        actions={[{ label: 'Zoom to fit', run: () => camera.fit() }]}
        disabled={inactive}
        {side}
      />
      <span class="divider" aria-hidden="true"></span>
      <ControlButton
        label={withShortcut('Zoom in', 'zoom-in')}
        icon={Plus}
        actions={[{ label: 'Zoom in', run: () => camera.in() }]}
        disabled={inactive || camera.zoom >= ZOOM_MAX}
        {side}
      />
      <ControlButton
        label={withShortcut('Reset to 100%', 'zoom-reset')}
        text={zoomPercent}
        actions={[{ label: 'Reset zoom', run: () => camera.reset() }]}
        disabled={inactive || camera.zoom >= ZOOM_MAX}
        {side}
      />
      <ControlButton
        label={withShortcut('Zoom out', 'zoom-out')}
        icon={Minus}
        actions={[{ label: 'Zoom out', run: () => camera.out() }]}
        disabled={inactive || camera.zoom <= ZOOM_MIN}
        {side}
      />
    </div>
  {/if}
</div>

<style>
  /* Docked white column on the left of the field: tools at the top, zoom
     at the bottom, each group clear of the edge. */
  .rail {
    box-sizing: border-box;
    flex: 0 0 40px;
    width: 40px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
    background-color: var(--c-white);
    border-right: 1px solid var(--c-border);
  }

  /* Phones: a full-width strip under the field. */
  .rail.horizontal {
    flex: 0 0 auto;
    width: 100%;
    height: calc(44px + env(safe-area-inset-bottom, 0px));
    flex-direction: row;
    padding: 0 12px env(safe-area-inset-bottom, 0px);
    border-right: none;
    border-top: 1px solid var(--c-border);
  }

  .group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .rail.horizontal .group {
    flex-direction: row;
  }

  .divider {
    width: 16px;
    height: 1px;
    margin: 4px 0;
    background-color: var(--c-border);
  }

  .rail.horizontal .divider {
    width: 1px;
    height: 16px;
    margin: 0 4px;
  }
</style>
