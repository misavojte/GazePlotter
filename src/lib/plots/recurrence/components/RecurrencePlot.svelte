<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'

  import RecurrencePlotFigure from './RecurrencePlotFigure.svelte'
  import { BasePlot } from '$lib/plots/shared/components'

  import { getRecurrenceData } from '$lib/plots/recurrence/core/transformer'
  import { buildHighlightMask } from '$lib/plots/recurrence/core/rqa'

  import type { RecurrencePlotItem } from '$lib/plots/recurrence/types'

  interface Props {
    item: RecurrencePlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const hasSpatial = $derived(engine.capabilities.spatial)
  const effectiveSettings = $derived.by(() => {
    if (hasSpatial) return settings
    return { ...settings, recurrenceMethod: 'aoi' as const }
  })

  const recurrenceData = $derived.by(() => {
    return getRecurrenceData(engine, effectiveSettings)
  })

  const highlightMask = $derived.by((): Uint8Array | null => {
    if (!recurrenceData) return null
    return buildHighlightMask(
      recurrenceData.matrix,
      recurrenceData.fixationCount,
      effectiveSettings.highlight,
      effectiveSettings.masking,
      effectiveSettings.minLineLength
    )
  })
</script>

<BasePlot {item} hasData={recurrenceData !== null} unavailableMessage={null}>
  {#snippet figure({ width, height })}
    <div class="figure-container">
      {#if recurrenceData}
        <RecurrencePlotFigure
          data={recurrenceData}
          highlight={effectiveSettings.highlight}
          masking={effectiveSettings.masking}
          {highlightMask}
          {width}
          {height}
        />
      {/if}
    </div>
  {/snippet}
</BasePlot>

<style>
  .figure-container {
    flex: 1;
    position: relative;
    height: 100%;
  }
</style>
