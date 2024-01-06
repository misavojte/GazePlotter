<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelectCompact.svelte'
  import { updateTimeline } from '$lib/stores/scarfPlotsStore.js'

  export let scarfId: number

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
      console.log(`Updating timeline for scarf ${scarfId} to ${value}`)
      updateTimeline(scarfId, value)
      break
    default:
      console.warn(`Invalid timeline value: ${value}`)
  }
</script>

<Select label="Timeline" options={timelineOptions} bind:value></Select>
