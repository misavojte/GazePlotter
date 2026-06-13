<script lang="ts">
  import StimulusPaneSection from '../StimulusPaneSection.svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { getPaneEditItems } from '$lib/workspace/pane'
  import { computeCommonValue, editTargets } from './common'
  import type { PaneSectionItem } from '$lib/plots/definePlot'

  let { item }: { item: PaneSectionItem } = $props()
  const { workspace } = getGazePlotterSession()
  const getItems = getPaneEditItems()
  const targets = $derived(editTargets(getItems, item))
  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))
  const common = $derived(computeCommonValue(targets.map(t => t.settings.stimulusId)))

  function apply(stimulusId: number) {
    workspace.updateItemsSettings(
      targets.map(t => t.id),
      { stimulusId },
      source
    )
  }
</script>

<StimulusPaneSection
  stimulusId={common.value}
  mixed={common.mixed}
  onchange={apply}
  {source}
/>
