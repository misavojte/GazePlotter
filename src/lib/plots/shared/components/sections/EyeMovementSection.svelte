<script lang="ts">
  import EyeMovementTypePaneSection from '../EyeMovementTypePaneSection.svelte'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type { PaneSectionItem } from '$lib/plots/definePlot'

  // Eye-movement categories are global engine data.
  let { item }: { item: PaneSectionItem } = $props()
  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))
</script>

<EyeMovementTypePaneSection {source} />
