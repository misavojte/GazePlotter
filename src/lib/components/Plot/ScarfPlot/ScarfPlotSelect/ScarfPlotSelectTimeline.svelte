<script lang="ts">
  import { run } from 'svelte/legacy';

  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'
  import type { GridStoreType } from '$lib/stores/gridStore'
  import { getDynamicAoiBoolean } from '$lib/services/scarfServices'
  import { hasStimulusAoiVisibility } from '$lib/stores/dataStore'
  import { getContext } from 'svelte'
  import { getScarfGridHeightFromCurrentData } from '$lib/services/scarfServices'
  import type { ScarfGridType } from '$lib/type/gridType'
  let store = getContext<GridStoreType>('gridStore')
  interface Props {
    settings: ScarfGridType;
  }

  let { settings }: Props = $props();

  let value = $state(settings.timeline)

  const timelineOptions = [
    { value: 'absolute', label: 'Absolute' },
    { value: 'relative', label: 'Relative' },
    { value: 'ordinal', label: 'Ordinal' },
  ]


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
  run(() => {
    switch (value) {
      case 'absolute':
      case 'relative':
      case 'ordinal':
        fireChange(value)
        break
      default:
        console.warn(`Invalid timeline value: ${value}`)
    }
  });
</script>

<Select label="Timeline" options={timelineOptions} bind:value compact={true}
></Select>
