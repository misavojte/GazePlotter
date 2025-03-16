<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import { getStimuli } from '$lib/stores/dataStore.js'
  import type { GridStoreType } from '$lib/stores/gridStore'
  import { getContext } from 'svelte'
  import type { ScarfGridType } from '$lib/type/gridType'

  let store = getContext<GridStoreType>('gridStore')
  export let settings: ScarfGridType

  let value: string = settings.stimulusId.toString()

  const stimuliOption = getStimuli().map(stimulus => {
    return {
      label: stimulus.displayedName,
      value: stimulus.id.toString(),
    }
  })

  $: fireChange(parseInt(value))

  const fireChange = (stimulusId: number) => {
    // Keep existing grid height for now
    const newSettings = { ...settings, stimulusId }
    store.updateSettings(newSettings)
  }
</script>

<Select label="Stimulus" options={stimuliOption} bind:value compact={true}
></Select>
