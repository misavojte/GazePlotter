<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import type { GridStoreType } from '$lib/stores/gridStore.ts'
  import { getDynamicAoiBoolean } from '$lib/services/scarfServices.ts'
  import { hasStimulusAoiVisibility } from '$lib/stores/dataStore.ts'
  import { getContext } from 'svelte'
  import { getScarfGridHeightFromCurrentData } from '$lib/services/scarfServices.ts'
  import type { ScarfGridType } from '$lib/type/gridType.ts'
  let store = getContext<GridStoreType>('gridStore')
  export let settings: ScarfGridType

  let value = settings.timeline

  const timelineOptions = [
    { value: 'absolute', label: 'Absolute' },
    { value: 'relative', label: 'Relative' },
    { value: 'ordinal', label: 'Ordinal' },
  ]

  $: switch (value) {
    case 'absolute':
    case 'relative':
    case 'ordinal':
      fireChange(value)
      break
    default:
      console.warn(`Invalid timeline value: ${value}`)
  }

  const fireChange = (timeline: 'absolute' | 'relative' | 'ordinal') => {
    const isDynamicAoi = getDynamicAoiBoolean(
      timeline,
      settings.dynamicAOI,
      hasStimulusAoiVisibility(settings.stimulusId)
    )
    const h = getScarfGridHeightFromCurrentData(
      settings.stimulusId,
      isDynamicAoi,
      settings.groupId
    )
    const newSettings = { ...settings, timeline, h }
    store.updateSettings(newSettings)
  }
</script>

<Select label="Timeline" options={timelineOptions} bind:value compact={true}
></Select>
