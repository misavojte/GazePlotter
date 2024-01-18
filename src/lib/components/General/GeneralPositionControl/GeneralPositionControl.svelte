<script lang="ts">
  import ArrowDown from 'lucide-svelte/icons/arrow-down'
  import ArrowUp from 'lucide-svelte/icons/arrow-up'
  import GeneralButtonMinor from '$lib/components/General/GeneralButton/GeneralButtonMinor.svelte'

  export let onMoveUp: () => void
  export let onMoveDown: () => void
  export let isFirst: boolean
  export let isLast: boolean
</script>

<GeneralButtonMinor isDisabled={isFirst} on:click={onMoveUp}>
  <ArrowUp size={'1em'} />
</GeneralButtonMinor>
<GeneralButtonMinor isDisabled={isLast} on:click={onMoveDown}>
  <ArrowDown size={'1em'} />
</GeneralButtonMinor>
