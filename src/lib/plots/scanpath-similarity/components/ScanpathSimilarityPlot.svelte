<script lang="ts">
  import { untrack } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'

  import { BasePlot } from '$lib/plots/shared/components'
  import { toggleInArray } from '$lib/plots/shared'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { getScanpathSimilarityView } from '../core/view'

  import type { ScanpathSimilarityItem } from '../types'

  interface Props {
    item: ScanpathSimilarityItem
  }

  let { item }: Props = $props()
  const { engine, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = untrack(() => createCommandSourcePlotPattern(item, 'plot'))

  const handleNodeClick = (nodeIndex: number) => {
    workspace.updateItemSettings(
      item.id,
      {
        participantHighlights: toggleInArray(settings.participantHighlights ?? [], nodeIndex),
      },
      source
    )
  }

  // Same view-model the export modal renders from; the screen adds the
  // node-click handler (scangraph), which export omits.
  const view = $derived(
    getScanpathSimilarityView(engine, settings, { onNodeClick: handleNodeClick })
  )
</script>

<BasePlot {item} hasData={view.hasData}>
  {#snippet figure({ width, height })}
    {@const Figure = view.component}
    <div class="figure-container">
      <Figure {...view.props} {width} {height} />
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
