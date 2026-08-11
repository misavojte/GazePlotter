import { untrack } from 'svelte'
import type { PlotScreenFactory } from '$lib/plots/definePlot'
import { toggleInArray } from '$lib/plots/shared'
import { plotCursorPort } from '$lib/plots/shared/plotCursor.svelte'
import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
import type { ScanpathSimilaritySettings } from '../types'

/**
 * Screen recipe: the shared PLOT CURSOR (matrix view: both axes are
 * participants) and the scangraph's node click, which toggles the PERSISTED
 * `highlightedParticipants` — a deliberate choice the user made, distinct from
 * the transient cursor and drawn by the scangraph only. Stored by participant
 * ID (the figure's node index maps through the view's participantIds), so the
 * emphasis follows the participant. Export gets neither the cursor nor the
 * click handler; the persisted highlight and clique emphasis still draw there.
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
    const ids = (ctx.view()?.props as { participantIds?: number[] } | undefined)
      ?.participantIds
    const pid = ids?.[nodeIndex]
    if (pid === undefined) return
    ctx.workspace.updateItemSettings(
      ctx.item.id,
      {
        highlightedParticipants: toggleInArray(
          ctx.item.settings.highlightedParticipants ?? [],
          pid
        ),
      },
      source
    )
  }

  return {
    props: () => ({ onNodeClick: handleNodeClick, plotCursor }),
  }
}

