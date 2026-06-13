<script lang="ts">
  import { PaneSection, PaneEditLink, PaneEditRow } from '$lib/workspace/pane'
  import { Select } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { getStimuliOptions } from '$lib/plots/shared'
  import { stimulusModificationModal } from '$lib/modals/definitions'

  interface Props {
    stimulusId: number
    onchange: (id: number) => void
    source: string
    /** Bulk mode: the selected plots have differing stimuli. Shows "Mixed"
     *  instead of a concrete value; picking an option applies it to all. */
    mixed?: boolean
  }

  let { stimulusId, onchange, source, mixed = false }: Props = $props()

  const { engine, modalState } = getGazePlotterSession()

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const stimulusSummary = $derived(
    mixed
      ? 'Mixed'
      : (stimulusOptions.find(o => o.value === String(stimulusId))?.label ?? '')
  )

  function openStimuli() {
    modalState.open(stimulusModificationModal, { source })
  }
</script>

<PaneSection title="Stimulus" summary={stimulusSummary} defaultOpen>
  <Select
    options={stimulusOptions}
    value={String(stimulusId)}
    {mixed}
    onchange={e => {
      onchange(Number(e.detail))
    }}
  />
  <PaneEditRow>
    <PaneEditLink onclick={openStimuli}>Edit stimulus library…</PaneEditLink>
  </PaneEditRow>
</PaneSection>
