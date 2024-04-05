<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'

  import type { ScarfSettingsType } from '$lib/type/Settings/ScarfSettings/ScarfSettingsType.ts'
  export let settings: ScarfSettingsType

  let value = 'absolute'

  const timelineOptions = [
    { value: 'absolute', label: 'Absolute' },
    { value: 'relative', label: 'Relative' },
    { value: 'ordinal', label: 'Ordinal' },
  ]

  $: switch (value) {
    case 'absolute':
    case 'relative':
    case 'ordinal':
      settings.timeline = value
      break
    default:
      console.warn(`Invalid timeline value: ${value}`)
  }
</script>

<Select label="Timeline" options={timelineOptions} bind:value compact={true}
></Select>
