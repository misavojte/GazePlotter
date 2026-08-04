import { untrack } from 'svelte'
import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { toggleInArray } from '$lib/plots/shared'
import { plotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
import type { ScanpathSimilaritySettings } from '../types'

/**
 * Screen recipe: the shared PLOT CURSOR (matrix view: both axes are
 * participants) and the scangraph's node click, which toggles the PERSISTED
 * `participantHighlights` — a deliberate choice the user made, distinct from the
 * transient cursor and drawn by the scangraph only. Export renders without both.
 */
export const scanpathSimilarityScreen: PlotScreenFactory<
  ScanpathSimilaritySettings
> = ctx => {
  const source = untrack(() =>
    createCommandSourcePlotPattern(ctx.item, 'plot')
  )

  // No time axis here, so no time scope.
  const plotCursor = plotCursorPort(ctx.item.id)

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
    props: () => ({ onNodeClick: handleNodeClick, plotCursor }),
  }
}

