<script lang="ts">
  import AoiPaneSection from '../AoiPaneSection.svelte'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type { PaneSectionItem } from '$lib/plots/definePlot'

  // AOIs are engine data scoped to a stimulus (not per-plot settings), so this
  // section edits the representative's stimulus globally; nothing to bulk-apply.
  let { item }: { item: PaneSectionItem } = $props()
  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))
</script>

<AoiPaneSection stimulusId={item.settings.stimulusId} {source} />
