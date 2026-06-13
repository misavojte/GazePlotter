<script lang="ts">
  import ParticipantGroupPaneSection from '../ParticipantGroupPaneSection.svelte'
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
  const common = $derived(
    computeCommonValue(targets.map(t => (t.settings as { groupId: number }).groupId))
  )

  function apply(groupId: number) {
    workspace.updateItemsSettings(targets.map(t => t.id), { groupId }, source)
  }
</script>

<!-- Group options depend on a stimulus, but group ids are stimulus-independent,
     so the representative's stimulus is safe even across mixed stimuli. -->
<ParticipantGroupPaneSection
  groupId={common.value}
  stimulusId={item.settings.stimulusId}
  mixed={common.mixed}
  onchange={apply}
  {source}
/>
