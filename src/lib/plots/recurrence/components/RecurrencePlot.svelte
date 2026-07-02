<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'

  import RecurrencePlotFigure from './RecurrencePlotFigure.svelte'
  import { BasePlot } from '$lib/plots/shared/components'

  import { getRecurrenceView } from '$lib/plots/recurrence/core/view'
  import { usePlotData } from '$lib/plots/shared/plotData.svelte'

  import type { RecurrencePlotItem } from '$lib/plots/recurrence/types'

  interface Props {
    item: RecurrencePlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()

  // Same view-model the export modal renders from.
  const viewData = usePlotData({
    epoch: () => item.redrawTimestamp,
    settings: () => item.settings,
    derive: s => getRecurrenceView(engine, s),
  })
  const view = $derived(viewData.current)
</script>

<BasePlot {item}>
  {#snippet figure({ width, height })}
    <div class="figure-container">
      <RecurrencePlotFigure {...view.props} {width} {height} />
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
