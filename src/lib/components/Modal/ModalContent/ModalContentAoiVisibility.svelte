<script lang="ts">
  import GeneralSelectBase from '../../General/GeneralSelect/GeneralSelect.svelte'
  import { getParticipants, getStimuli } from '$lib/stores/dataStore.js'
  import GeneralInputFile from '../../General/GeneralInput/GeneralInputFile.svelte'
  import GeneralButtonMajor from '../../General/GeneralButton/GeneralButtonMajor.svelte'
  import { AoiVisibilityParser } from '$lib/class/AoiVisibilityParser/AoiVisibilityParser.js'
  import { addErrorToast, addSuccessToast } from '$lib/stores/toastStore.js'
  import { updateAoiVisibilityForAll } from '$lib/stores/scarfPlotsStore.js'

  let files: FileList | null = null
  let selectedStimulusId = '0'
  let selectedParticipantId = 'all'

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
    files[0]
      .text()
      .then(x => {
        const parser = new DOMParser()
        const xml = parser.parseFromString(x, 'application/xml')
        const stimulusId = parseInt(selectedStimulusId)
        const participantId =
          selectedParticipantId === 'all'
            ? null
            : parseInt(selectedParticipantId)
        new AoiVisibilityParser().addVisInfo(stimulusId, participantId, xml)
        updateAoiVisibilityForAll(true)
        addSuccessToast('File was read successfully')
      })
      .catch(e => {
        console.error(e)
        addErrorToast('Could not add AOI visibility. See console')
      })
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
