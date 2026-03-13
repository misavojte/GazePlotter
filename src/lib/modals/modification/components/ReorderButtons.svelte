<script lang="ts">
  import { GeneralButtonMinor } from '$lib/shared/components'
  import ArrowDown from 'lucide-svelte/icons/arrow-down'
  import ArrowUp from 'lucide-svelte/icons/arrow-up'

  interface Props {
    onMoveUp: () => void
    onMoveDown: () => void
    isFirst: boolean
    isLast: boolean
  }

  let { onMoveUp, onMoveDown, isFirst, isLast }: Props = $props()
</script>

<GeneralButtonMinor isDisabled={isFirst} onclick={onMoveUp}>
  <ArrowUp size={'1em'} />
</GeneralButtonMinor>
<GeneralButtonMinor isDisabled={isLast} onclick={onMoveDown}>
  <ArrowDown size={'1em'} />
</GeneralButtonMinor>
