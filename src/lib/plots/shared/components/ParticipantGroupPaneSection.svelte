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
    /** Bulk mode: the selected plots have differing groups. Shows "Mixed"
     *  instead of a concrete value; picking an option applies it to all. */
    mixed?: boolean
  }

  let { groupId, stimulusId, onchange, source, mixed = false }: Props = $props()

  const { engine, modalState } = getGazePlotterSession()

  const groupOptions = $derived(
    getParticipantsGroupOptions(engine, true, stimulusId)
  )
  const groupSummary = $derived(
    mixed
      ? 'Mixed'
      : (groupOptions.find(o => o.value === String(groupId))?.label ?? '')
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
    {mixed}
    onchange={e => {
      onchange(Number(e.detail))
    }}
  />
  <PaneEditRow>
    <PaneEditLink onclick={openGroups}>Edit groups…</PaneEditLink>
    <PaneEditLink onclick={openParticipants}>Edit participants…</PaneEditLink>
  </PaneEditRow>
</PaneSection>
