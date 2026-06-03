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
  }

  let { stimulusId, onchange, source }: Props = $props()

  const { engine, modalState } = getGazePlotterSession()

  const stimulusOptions = $derived(getStimuliOptions(engine))
  const stimulusSummary = $derived(
    stimulusOptions.find(o => o.value === String(stimulusId))?.label ?? ''
  )

  function openStimuli() {
    modalState.open(stimulusModificationModal, { source })
  }
</script>

<PaneSection title="Stimulus" summary={stimulusSummary} defaultOpen>
  <Select
    options={stimulusOptions}
    value={String(stimulusId)}
    onchange={e => {
      onchange(Number((e as CustomEvent).detail))
    }}
  />
  <PaneEditRow>
    <PaneEditLink onclick={openStimuli}>Edit stimulus library…</PaneEditLink>
  </PaneEditRow>
</PaneSection>
