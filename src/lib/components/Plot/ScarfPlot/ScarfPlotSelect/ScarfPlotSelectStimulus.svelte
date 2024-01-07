<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { getStimuli } from '$lib/stores/dataStore.js'
  import { updateStimulusId } from '$lib/stores/scarfPlotsStore.js'

  export let scarfId: number

  let value: string

  /**
   * TODO: Make reactive in the future (when stimuli can be updated)
   */
  const stimuliOption = getStimuli().map(stimulus => {
    return {
      label: stimulus.displayedName,
      value: stimulus.id.toString(),
    }
  })

  $: if (parseInt(value) >= 0) {
    updateStimulusId(scarfId, parseInt(value))
  }
</script>

<Select label="Stimulus" options={stimuliOption} bind:value compact={true}
></Select>
