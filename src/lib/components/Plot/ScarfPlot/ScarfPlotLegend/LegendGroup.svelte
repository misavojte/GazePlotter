<script lang="ts">
  import LegendItem from './LegendItem.svelte'
  import SvgText from '$lib/components/Plot/SvgText.svelte'
  import type { SingleStylingScarfFillingType } from '$lib/type/Filling/ScarfFilling/index'

  interface Props {
    title: string
    items: SingleStylingScarfFillingType[]
    x?: number
    y?: number
    itemsPerRow: number
    fixedItemWidth?: number
    itemSpacing?: number
    titleHeight?: number
    itemHeight?: number
    itemPadding?: number
    iconWidth?: number
    textPadding?: number
    type?: 'rect' | 'line'
    onItemClick: (identifier: string) => void
    highlightedIdentifier?: string | null
  }

  let {
    title,
    items,
    x = 0,
    y = 0,
    itemsPerRow,
    fixedItemWidth = 100,
    itemSpacing = 8,
    titleHeight = 18,
    itemHeight = 15,
    itemPadding = 8,
    iconWidth = 20,
    textPadding = 8,
    type = 'rect',
    onItemClick,
    highlightedIdentifier = null,
  }: Props = $props()

  // Calculate width for the group
  const groupWidth = $derived.by(() => {
    const columns = Math.min(itemsPerRow, items.length)
    if (columns === 0) return 0
    return columns * fixedItemWidth + (columns - 1) * itemSpacing
  })
</script>

<g class="legend-group">
  <SvgText
    text={title}
    {x}
    y={y + titleHeight - 7}
    className="legend-title"
    fontSize="12px"
  />
  <g width={groupWidth}>
    {#each items as item, i}
      {@const row = Math.floor(i / itemsPerRow)}
      {@const col = i % itemsPerRow}
      {@const itemX = x + col * (fixedItemWidth + itemSpacing)}
      {@const itemY = y + titleHeight + row * (itemHeight + itemPadding)}

      <LegendItem
        identifier={item.identifier}
        name={item.name}
        color={item.color}
        height={item.height}
        x={itemX}
        y={itemY}
        {fixedItemWidth}
        {itemHeight}
        {iconWidth}
        {textPadding}
        {type}
        onClick={onItemClick}
        highlighted={item.identifier === highlightedIdentifier}
        anyHighlightActive={highlightedIdentifier !== null}
      />
    {/each}
  </g>
</g>

<style>
  .legend-title {
    font-weight: 500;
  }
</style>
