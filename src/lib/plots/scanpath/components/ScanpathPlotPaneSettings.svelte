<script lang="ts">
  import { PaneSection, PaneEditLink, PaneEditRow } from '$lib/workspace/pane'
  import { InputCheck, Select } from '$lib/shared/components'
  import {
    getStimuliOptions,
    getParticipantOptions,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import {
    participantModificationModal,
    stimulusModificationModal,
  } from '$lib/modals/definitions'
  import { AoiPaneSection } from '$lib/plots/shared/components'
  import type { ScanpathPlotItem, ScanpathPlotSettings } from '../types'

  interface Props {
    item: ScanpathPlotItem
  }

  let { item }: Props = $props()
  const { engine, modalState, workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<ScanpathPlotSettings>) {
    workspace.updateItemSettings(item.id, patch, source)
  }

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const participantOptions = $derived(getParticipantOptions(engine))
  const stimulusSummary = $derived(
    stimulusOptions.find(o => o.value === String(settings.stimulusId))?.label ?? ''
  )
  const participantSummary = $derived(
    participantOptions.find(o => o.value === String(settings.participantId))?.label ?? ''
  )

  const openStimuli = () => modalState.open(stimulusModificationModal, { source })
  const openParticipants = () =>
    modalState.open(participantModificationModal, { source })
</script>

<PaneSection title="Stimulus" summary={stimulusSummary} defaultOpen>
  <Select
    options={stimulusOptions}
    value={String(settings.stimulusId)}
    onchange={e => update({ stimulusId: Number((e as CustomEvent).detail) })}
  />
  <PaneEditRow>
    <PaneEditLink onclick={openStimuli}>Edit stimulus library…</PaneEditLink>
  </PaneEditRow>
</PaneSection>

<AoiPaneSection stimulusId={settings.stimulusId} {source} />

<PaneSection title="Participant" summary={participantSummary}>
  <Select
    options={participantOptions}
    value={String(settings.participantId)}
    onchange={e => update({ participantId: Number((e as CustomEvent).detail) })}
  />
  <PaneEditLink onclick={openParticipants}>Edit participants…</PaneEditLink>
</PaneSection>

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


