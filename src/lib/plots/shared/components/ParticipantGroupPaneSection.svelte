<script lang="ts">
  import { PaneSection, PaneEditLink, PaneEditRow } from '$lib/workspace/pane'
  import { Select } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { getParticipantsGroupOptions } from '$lib/plots/shared'
  import {
    participantsGroupsModal,
    participantModificationModal,
  } from '$lib/modals/definitions'

  interface Props {
    groupId: number
    stimulusId: number
    onchange: (id: number) => void
    source: string
  }

  let { groupId, stimulusId, onchange, source }: Props = $props()

  const { engine, modalState } = getGazePlotterSession()

  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, stimulusId)
  )
  const groupSummary = $derived(
    groupOptions.find(o => o.value === String(groupId))?.label ?? ''
  )

  function openGroups() {
    modalState.open(participantsGroupsModal, { source })
  }
  function openParticipants() {
    modalState.open(participantModificationModal, { source })
  }
</script>

<PaneSection title="Participant group" summary={groupSummary}>
  <Select
    options={groupOptions}
    value={String(groupId)}
    onchange={e => {
      onchange(Number((e as CustomEvent).detail))
    }}
  />
  <PaneEditRow>
    <PaneEditLink onclick={openGroups}>Edit groups…</PaneEditLink>
    <PaneEditLink onclick={openParticipants}>Edit participants…</PaneEditLink>
  </PaneEditRow>
</PaneSection>
