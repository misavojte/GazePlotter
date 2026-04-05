<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { ScarfPlotItem } from '$lib/plots/scarf/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import ScarfPlotFigure from './ScarfPlotFigure.svelte'
  import { transformDataToScarfPlot } from '$lib/plots/scarf/core/transformer'
  import { getParticipants } from '$lib/data/engine'
  import type { BaseInterpretedDataType } from '$lib/data/types'
  import { untrack } from 'svelte'

  interface Props {
    item: ScarfPlotItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)

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
