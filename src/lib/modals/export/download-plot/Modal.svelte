<script lang="ts">
  import { untrack } from 'svelte'
  import { resolvePlotDefinition } from '$lib/plots/registry'
  import type { PlotView, PlotViewContext } from '$lib/plots/definePlot'
  import {
    DEFAULT_CANVAS_EXPORT_MARGIN,
    getWorkspaceCanvasExportDimensions,
  } from '$lib/modals/export/shared/helpers'
  import DownloadPlotSettings from './DownloadPlotSettings.svelte'
  import CanvasPreview from './CanvasPreview.svelte'
  import Section from '$lib/modals/shared/components/Section.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import type { AllGridTypes } from '$lib/workspace/grid'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import type { PlotExportProps } from './types'

  interface Props {
    item: AllGridTypes
  }

  let { item }: Props = $props()
  const { engine, grid } = getGazePlotterSession()

  const definition = $derived(resolvePlotDefinition(item.type))
  const exportConfig = $derived(definition.export)

  const exportDimensions = $derived(
    getWorkspaceCanvasExportDimensions(item, grid.config, DEFAULT_CANVAS_EXPORT_MARGIN)
  )

  // Preferred path: the plot's `deriveView` yields the figure component + its
  // data props; we render it generically with the export sizing. Both screen
  // and export derive from the same view-model, so they can't drift. The
  // definition is resolved generically, so deriveView is cast to a loose
  // signature (its settings type is guaranteed to match `item` at runtime).
  const deriveView = $derived(
    exportConfig?.deriveView as
      | ((engine: DataEngine, settings: unknown, ctx?: PlotViewContext) => PlotView | null)
      | undefined
  )
  const view = $derived(
    deriveView
      ? deriveView(engine, (item as { settings: unknown }).settings, {
          gridItems: grid.items,
          itemWidth: item.w,
          itemHeight: item.h,
        })
      : null
  )

  // Export settings state
  let typeOfExport = $state<'.png' | '.jpg'>('.png')
  let width = $state(untrack(() => exportDimensions.width))
  let height = $state(untrack(() => exportDimensions.height))
  let fileName = $state(untrack(() => `GazePlotter-${definition.name.replace(/\s+/g, '')}`))
  let dpi = $state(96)
  let marginTop = $state(DEFAULT_CANVAS_EXPORT_MARGIN)
  let marginRight = $state(DEFAULT_CANVAS_EXPORT_MARGIN)
  let marginBottom = $state(DEFAULT_CANVAS_EXPORT_MARGIN)
  let marginLeft = $state(DEFAULT_CANVAS_EXPORT_MARGIN)

  // Figures receive the TOTAL canvas size (the user-typed export dimensions);
  // every figure treats `width`/`height` as total and carves the export margins
  // out of it, so the exported image is exactly width × height.
  const exportProps: PlotExportProps = $derived({
    width: Math.max(1, width),
    height: Math.max(1, height),
    dpiOverride: dpi,
    margins: {
      top: marginTop,
      right: marginRight,
      bottom: marginBottom,
      left: marginLeft,
    },
  })
</script>

{#if view}
  <div class="plot-export-container">
    <DownloadPlotSettings
      bind:typeOfExport
      bind:width
      bind:height
      bind:fileName
      bind:dpi
      bind:marginTop
      bind:marginRight
      bind:marginBottom
      bind:marginLeft
    />

    <Section title="Your exported plot">
      <CanvasPreview
        {fileName}
        fileType={typeOfExport}
        showDownloadButton={true}
      >
        {@const Figure = view.component}
        <Figure
          {...view.props}
          width={exportProps.width}
          height={exportProps.height}
          dpiOverride={exportProps.dpiOverride}
          margins={exportProps.margins}
        />
      </CanvasPreview>
    </Section>
  </div>
{/if}

<style>
  .plot-export-container {
    display: flex;
    flex-direction: column;
    max-height: 80vh;
    max-width: 830px;
  }
</style>
