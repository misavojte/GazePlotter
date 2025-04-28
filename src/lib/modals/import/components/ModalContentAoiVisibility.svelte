<script lang="ts">
  import GeneralSelectBase from '$lib/shared/components/GeneralSelect.svelte'
  import { getParticipants } from '$lib/gaze-data/front-process/stores/dataStore.js'
  import { GeneralInputFile, GeneralButtonMajor } from '$lib/shared/components'
  import { addErrorToast, addSuccessToast } from '$lib/toaster'
  import { processAoiVisibility } from '$lib/modals/import/utility/aoiVisibilityServices'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'
  interface Props {
    forceRedraw: () => void
  }

  let { forceRedraw }: Props = $props()

  let files: FileList | null = $state(null)
  let selectedStimulusId = $state('0')
  let selectedParticipantId = $state('all')

  const stimuliOptions = getStimuliOptions()
  const participantOptions = [{ label: 'To all', value: 'all' }].concat(
    getParticipants().map(participant => {
      return {
        label: participant.displayedName,
        value: participant.id.toString(),
      }
    })
  )
  const handleSubmit = () => {
    if (files === null) {
      addErrorToast('No file selected')
      return
    }
    try {
      const stimulusId = parseInt(selectedStimulusId)
      const participantId =
        selectedParticipantId === 'all' ? null : parseInt(selectedParticipantId)
      processAoiVisibility(stimulusId, participantId, files).then(() => {
        addSuccessToast('AOI visibility updated')
        forceRedraw()
      })
    } catch (e) {
      console.error(e)
      const message = e instanceof Error ? e.message : 'Unknown error'
      addErrorToast('Could not read file. ' + message)
    }
  }
</script>

<div class="content">
  <GeneralSelectBase
    label="For stimulus"
    options={stimuliOptions}
    bind:value={selectedStimulusId}
  />
  <GeneralSelectBase
    label="For participant"
    options={participantOptions}
    bind:value={selectedParticipantId}
  />
  <GeneralInputFile label="AOI visibility file" bind:files />
</div>
<GeneralButtonMajor onclick={handleSubmit}>Apply</GeneralButtonMajor>

<style>
  .content {
    margin-bottom: 25px;
  }
</style>
