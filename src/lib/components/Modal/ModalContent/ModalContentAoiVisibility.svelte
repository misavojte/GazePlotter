<script lang="ts">
  import GeneralSelectBase from '../../General/GeneralSelect/GeneralSelect.svelte'
  import { getParticipants, getStimuli } from '$lib/stores/dataStore.js'
  import GeneralInputFile from '../../General/GeneralInput/GeneralInputFile.svelte'
  import GeneralButtonMajor from '../../General/GeneralButton/GeneralButtonMajor.svelte'
  import { addErrorToast, addSuccessToast } from '$lib/stores/toastStore.js'
  import { processAoiVisibility } from '$lib/services/aoiVisibilityServices'

  let files: FileList | null = $state(null)
  let selectedStimulusId = $state('0')
  let selectedParticipantId = $state('all')

  const stimuliOptions = getStimuli().map(stimulus => {
    return {
      label: stimulus.displayedName,
      value: stimulus.id.toString(),
    }
  })
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
<GeneralButtonMajor on:click={handleSubmit}>Apply</GeneralButtonMajor>

<style>
  .content {
    margin-bottom: 25px;
  }
</style>
