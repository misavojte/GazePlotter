<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'

  import RecurrencePlotFigure from './RecurrencePlotFigure.svelte'
  import { BasePlot } from '$lib/plots/shared/components'

  import { getRecurrenceView } from '$lib/plots/recurrence/core/view'

  import type { RecurrencePlotItem } from '$lib/plots/recurrence/types'

  interface Props {
    item: RecurrencePlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()

  // Same view-model the export modal renders from.
  const view = $derived(getRecurrenceView(engine, item.settings))
</script>

<BasePlot {item} hasData={view !== null} unavailableMessage={null}>
  {#snippet figure({ width, height })}
    <div class="figure-container">
      {#if view}
        <RecurrencePlotFigure {...view.props} {width} {height} />
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
