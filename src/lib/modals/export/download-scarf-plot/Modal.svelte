<script lang="ts">
  import type { ScarfPlotItem } from '$lib/plots/scarf/types'
  import ScarfPlotFigure from '$lib/plots/scarf/components/ScarfPlotFigure.svelte'
  import { transformDataToScarfPlot } from '$lib/plots/scarf/core/transformer'
  import {
    DEFAULT_CANVAS_EXPORT_MARGIN,
    getWorkspaceCanvasExportDimensions,
  } from '$lib/modals/export/shared/helpers'
  import { PlotExportWrapper } from '$lib/modals'
  import { getParticipants } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import type { BaseInterpretedDataType } from '$lib/data/types'
  import { untrack } from 'svelte'

  interface Props {
    item: ScarfPlotItem
  }

  let { item }: Props = $props()
  const { engine, grid } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const exportDimensions = $derived(
    getWorkspaceCanvasExportDimensions(
      item,
      grid.config,
      DEFAULT_CANVAS_EXPORT_MARGIN
    )
  )

  const obtainedData = $derived.by(() => {
    const meta = engine.metadata
    if (!meta) throw new Error('Data engine metadata not available')

    return transformDataToScarfPlot(
      engine,
      untrack(() => settings.stimulusId),
      untrack(() =>
        getParticipants(engine, settings.groupId, settings.stimulusId).map(
          (participant: BaseInterpretedDataType) => participant.id
        )
      ),
      untrack(() => settings),
      meta.noAoiTreatment
    )
  })
</script>

<PlotExportWrapper
  defaultFileName="GazePlotter-ScarfPlot"
  defaultWidth={exportDimensions.width}
  defaultHeight={exportDimensions.height}
  defaultMargin={DEFAULT_CANVAS_EXPORT_MARGIN}
>
  {#snippet children(exportProps)}
    {#if obtainedData}
      {@const data = obtainedData}
      <ScarfPlotFigure
        dpiOverride={exportProps.dpiOverride}
        marginTop={exportProps.marginTop}
        marginRight={exportProps.marginRight}
        marginBottom={exportProps.marginBottom}
        marginLeft={exportProps.marginLeft}
        {data}
        {settings}
        chartWidth={exportProps.width}
        availableHeight={exportProps.height}
        highlights={settings.highlights ?? []}
        tooltipAreaElement={null}
        onLegendClick={() => {}}
        onTooltipActivation={() => {}}
        onTooltipDeactivation={() => {}}
      />
    {/if}
  {/snippet}
</PlotExportWrapper>
