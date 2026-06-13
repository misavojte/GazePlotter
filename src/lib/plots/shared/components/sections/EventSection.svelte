<script lang="ts">
  import EventPaneSection from '../EventPaneSection.svelte'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type { PaneSectionItem } from '$lib/plots/definePlot'

  // Event channels are engine data scoped to a stimulus; edits the
  // representative's stimulus globally.
  let { item }: { item: PaneSectionItem } = $props()
  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))
</script>

<EventPaneSection stimulusId={item.settings.stimulusId} {source} />
