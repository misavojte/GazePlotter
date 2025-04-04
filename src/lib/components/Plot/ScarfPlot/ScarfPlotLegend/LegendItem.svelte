<script lang="ts">
  import SvgText from '$lib/components/Plot/SvgText.svelte'

  interface Props {
    identifier: string
    name: string
    color: string
    height: number
    x?: number
    y?: number
    fixedItemWidth?: number
    itemHeight?: number
    iconWidth?: number
    textPadding?: number
    type?: 'rect' | 'line'
    onClick: (identifier: string) => void
  }

  let {
    identifier,
    name,
    color,
    height,
    x = 0,
    y = 0,
    fixedItemWidth = 100,
    itemHeight = 15,
    iconWidth = 20,
    textPadding = 8,
    type = 'rect',
    onClick,
  }: Props = $props()

  // Function to truncate legend text
  const truncateText = (text: string, maxLength = 12) => {
    return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text
  }
</script>

<g class="legend-item {identifier}" on:click={() => onClick(identifier)}>
  <rect
    {x}
    {y}
    class="legend-item-bg"
    width={fixedItemWidth}
    height={itemHeight}
    fill="transparent"
    rx="2"
  />

  {#if type === 'rect'}
    <rect
      {x}
      y={y + (itemHeight - height) / 2}
      class={identifier}
      width={iconWidth}
      {height}
      fill={color}
    />
  {:else}
    <line
      x1={x}
      y1={y + itemHeight / 2}
      x2={x + iconWidth}
      y2={y + itemHeight / 2}
      stroke={color}
      stroke-width="2px"
      class={identifier}
    />
  {/if}

  <SvgText
    text={truncateText(name)}
    x={x + iconWidth + textPadding}
    y={y + itemHeight - 4}
    fontSize="12px"
  />
</g>

<style>
  .legend-item {
    cursor: pointer;
  }

  .legend-item:hover .legend-item-bg {
    fill: rgba(0, 0, 0, 0.05);
  }
</style>
