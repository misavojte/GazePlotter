<script lang="ts">
  import { run } from 'svelte/legacy';

  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import {
    getStimuli,
    hasStimulusAoiVisibility,
  } from '$lib/stores/dataStore.js'
  import {
    getDynamicAoiBoolean,
    getScarfGridHeightFromCurrentData,
  } from '$lib/services/scarfServices'
  import type { GridStoreType } from '$lib/stores/gridStore'
  import { getContext } from 'svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  let store = getContext<GridStoreType>('gridStore')
  interface Props {
    settings: ScarfGridType;
  }

  let { settings }: Props = $props();

  let value: string = $state(settings.stimulusId.toString())

  /**
   * TODO: Make reactive in the future (when stimuli can be updated)
   */
  const stimuliOption = getStimuli().map(stimulus => {
    return {
      label: stimulus.displayedName,
      value: stimulus.id.toString(),
    }
  })


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
  run(() => {
    fireChange(parseInt(value))
  });
</script>

<Select label="Stimulus" options={stimuliOption} bind:value compact={true}
></Select>
