<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { RecurrencePlotItem } from '$lib/plots/recurrence/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import RecurrencePlotFigure from './RecurrencePlotFigure.svelte'
  import { getRecurrenceData } from '$lib/plots/recurrence/core/transformer'
  import { buildHighlightMask } from '$lib/plots/recurrence/core/highlightMask'

  interface Props {
    item: RecurrencePlotItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)

  const recurrenceData = $derived.by(() => {
    return getRecurrenceData(engine, settings)
  })

  const highlightMask = $derived.by((): Uint8Array | null => {
    if (!recurrenceData) return null
    return buildHighlightMask(
      recurrenceData.matrix,
      recurrenceData.fixationCount,
      settings.highlight,
      settings.masking,
      settings.minLineLength
    )
  })
</script>

{#if recurrenceData}
  <RecurrencePlotFigure
    data={recurrenceData}
    highlight={settings.highlight}
    masking={settings.masking}
    {highlightMask}
    width={exportProps.width}
    height={exportProps.height}
    dpiOverride={exportProps.dpiOverride}
    marginTop={exportProps.marginTop}
    marginRight={exportProps.marginRight}
    marginBottom={exportProps.marginBottom}
    marginLeft={exportProps.marginLeft}
  />
{/if}
