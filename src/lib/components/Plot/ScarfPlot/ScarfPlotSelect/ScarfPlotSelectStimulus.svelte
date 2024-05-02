<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import {
    getStimuli,
    hasStimulusAoiVisibility,
  } from '$lib/stores/dataStore.js'
  import {
    getDynamicAoiBoolean,
    getScarfGridHeightFromCurrentData,
  } from '$lib/services/scarfServices.ts'
  import type { GridStoreType } from '$lib/stores/gridStore.ts'
  import { getContext } from 'svelte'
  import type { ScarfGridType } from '$lib/type/gridType.ts'
  let store = getContext<GridStoreType>('gridStore')
  export let settings: ScarfGridType

  let value: string = settings.stimulusId.toString()

  /**
   * TODO: Make reactive in the future (when stimuli can be updated)
   */
  const stimuliOption = getStimuli().map(stimulus => {
    return {
      label: stimulus.displayedName,
      value: stimulus.id.toString(),
    }
  })

  $: fireChange(parseInt(value))

  const fireChange = (stimulusId: number) => {
    const h = getScarfGridHeightFromCurrentData(
      stimulusId,
      getDynamicAoiBoolean(
        settings.timeline,
        settings.dynamicAOI,
        hasStimulusAoiVisibility(stimulusId)
      ),
      settings.groupId
    )
    const newSettings = { ...settings, stimulusId, h }
    store.updateSettings(newSettings)
  }
</script>

<Select label="Stimulus" options={stimuliOption} bind:value compact={true}
></Select>
