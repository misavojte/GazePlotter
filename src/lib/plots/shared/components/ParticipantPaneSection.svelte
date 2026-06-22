<script lang="ts">
  import { PaneSection, PaneEditLink } from '$lib/workspace/pane'
  import { Select } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { getParticipantOptions } from '$lib/plots/shared'
  import { participantModificationModal } from '$lib/modals/definitions'

  interface Props {
    participantId: number
    onchange: (id: number) => void
    source: string
    /** Bulk mode: selected plots have differing participants. Shows "Mixed"
     *  instead of a concrete value; picking an option applies it to all. */
    mixed?: boolean
  }

  let { participantId, onchange, source, mixed = false }: Props = $props()

  const { engine, modalState } = getGazePlotterSession()

  const participantOptions = $derived(getParticipantOptions(engine))
  const participantSummary = $derived(
    mixed
      ? 'Mixed'
      : (participantOptions.find(o => o.value === String(participantId))
          ?.label ?? '')
  )

  function openParticipants() {
    modalState.open(participantModificationModal, { source })
  }
</script>

<PaneSection title="Participant" summary={participantSummary}>
  <Select
    options={participantOptions}
    value={String(participantId)}
    {mixed}
    onchange={e => {
      onchange(Number(e.detail))
    }}
  />
  <PaneEditLink onclick={openParticipants}>Edit participants…</PaneEditLink>
</PaneSection>
