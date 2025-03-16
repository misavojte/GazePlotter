<script lang="ts">
  import ArrowDown from 'lucide-svelte/icons/arrow-down'
  import ArrowUp from 'lucide-svelte/icons/arrow-up'
  import GeneralButtonMinor from '$lib/components/General/GeneralButton/GeneralButtonMinor.svelte'

  interface Props {
    onMoveUp: () => void;
    onMoveDown: () => void;
    isFirst: boolean;
    isLast: boolean;
  }

  let {
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast
  }: Props = $props();
</script>

<GeneralButtonMinor isDisabled={isFirst} on:click={onMoveUp}>
  <ArrowUp size={'1em'} />
</GeneralButtonMinor>
<GeneralButtonMinor isDisabled={isLast} on:click={onMoveDown}>
  <ArrowDown size={'1em'} />
</GeneralButtonMinor>
