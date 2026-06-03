<script lang="ts">
  import { PaneSection } from '$lib/workspace/pane'
  import { InputCheck } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    AoiPaneSection,
    StimulusPaneSection,
    ParticipantPaneSection,
  } from '$lib/plots/shared/components'
  import type { ScanpathPlotItem, ScanpathPlotSettings } from '../types'

  interface Props {
    item: ScanpathPlotItem
  }

  let { item }: Props = $props()
  const { workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<ScanpathPlotSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }
</script>

<StimulusPaneSection
  stimulusId={settings.stimulusId}
  onchange={id => update({ stimulusId: id })}
  {source}
/>

<ParticipantPaneSection
  participantId={settings.participantId}
  onchange={id => update({ participantId: id })}
  {source}
/>

<PaneSection title="Display">
  <InputCheck
    label="Show fixation order line"
    appearance="compact"
    size="xs"
    checked={settings.showFixationOrder}
    onchange={e =>
      update({ showFixationOrder: (e as CustomEvent<boolean>).detail })}
  />
  <InputCheck
    label="Show fixation numbers"
    appearance="compact"
    size="xs"
    checked={settings.showNumbers}
    onchange={e => update({ showNumbers: (e as CustomEvent<boolean>).detail })}
  />
</PaneSection>

<AoiPaneSection stimulusId={settings.stimulusId} {source} />


