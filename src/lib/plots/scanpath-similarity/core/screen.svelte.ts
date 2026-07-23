import { untrack } from 'svelte'
import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { toggleInArray } from '$lib/plots/shared'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
import type { ScanpathSimilaritySettings } from '../types'

/**
 * Screen recipe: the scangraph's node click toggles the participant highlight
 * via a workspace command. Export renders without the handler.
 */
export const scanpathSimilarityScreen: PlotScreenFactory<
  ScanpathSimilaritySettings
> = ctx => {
  const source = untrack(() =>
    createCommandSourcePlotPattern(ctx.item, 'plot')
  )

  const handleNodeClick = (nodeIndex: number) => {
    ctx.workspace.updateItemSettings(
      ctx.item.id,
      {
        participantHighlights: toggleInArray(
          ctx.item.settings.participantHighlights ?? [],
          nodeIndex
        ),
      },
      source
    )
  }

  return {
    props: () => ({ onNodeClick: handleNodeClick }),
  }
}

