<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'

  import { BasePlot } from '$lib/plots/shared/components'
  import { deriveMetricCorrelationView } from '../core/view'
  import { usePlotData } from '$lib/plots/shared/plotData.svelte'
  import type { MetricCorrelationItem } from '../types'

  interface Props {
    item: MetricCorrelationItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()

  // Same view-model the export modal renders from.
  const viewData = usePlotData({
    epoch: () => item.redrawTimestamp,
    settings: () => item.settings,
    derive: s => deriveMetricCorrelationView(engine, s),
  })
  const view = $derived(viewData.current)
</script>

<BasePlot {item}>
  {#snippet figure({ width, height })}
    {@const Figure = view.component}
    <Figure {...view.props} {width} {height} />
  {/snippet}
</BasePlot>
