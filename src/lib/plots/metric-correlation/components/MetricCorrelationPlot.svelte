<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'

  import { BasePlot } from '$lib/plots/shared/components'
  import { deriveMetricCorrelationView } from '../core/view'
  import type { MetricCorrelationItem } from '../types'

  interface Props {
    item: MetricCorrelationItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()

  // Same view-model the export modal renders from.
  const view = $derived(deriveMetricCorrelationView(engine, item.settings))
</script>

<BasePlot {item}>
  {#snippet figure({ width, height })}
    {@const Figure = view.component}
    <Figure {...view.props} {width} {height} />
  {/snippet}
</BasePlot>
