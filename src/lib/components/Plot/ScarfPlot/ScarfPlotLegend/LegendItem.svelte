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
    highlighted?: boolean
    anyHighlightActive?: boolean
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
    highlighted = false,
    anyHighlightActive = false,
  }: Props = $props()

  // Function to truncate legend text
  const truncateText = (text: string, maxLength = 12) => {
    return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text
  }

  type StrokeLinecap =
    | 'butt'
    | 'inherit'
    | 'round'
    | 'square'
    | null
    | undefined

  // Calculate styles based on highlight state
  const highlightStyles = $derived.by(() => {
    if (highlighted) {
      return {
        bgFill: 'rgba(0, 0, 0, 0.05)',
        textWeight: 'bold',
        rectStroke: '#333333',
        rectStrokeWidth: 1,
        lineStrokeWidth: 3,
        lineDasharray: 'none',
        lineStrokeLinecap: 'butt' as StrokeLinecap,
        opacity: 1.0,
      }
    } else if (anyHighlightActive) {
      return {
        bgFill: 'transparent',
        textWeight: 'normal',
        rectStroke: 'none',
        rectStrokeWidth: 0,
        lineStrokeWidth: 2,
        lineDasharray: '1',
        lineStrokeLinecap: null as StrokeLinecap,
        opacity: 0.15,
      }
    } else {
      return {
        bgFill: 'transparent',
        textWeight: 'normal',
        rectStroke: 'none',
        rectStrokeWidth: 0,
        lineStrokeWidth: 2,
        lineDasharray: '1',
        lineStrokeLinecap: null as StrokeLinecap,
        opacity: 1.0,
      }
    }
  })
</script>

<g
  class="legend-item {identifier}"
  class:highlighted
  onclick={() => onClick(identifier)}
  onkeydown={event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick(identifier)
    }
  }}
  role="button"
  tabindex="0"
>
  <rect
    x={x - 5}
    y={y - 5}
    class="legend-item-bg"
    width={fixedItemWidth + 5}
    height={itemHeight + 10}
    fill={highlightStyles.bgFill}
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
      stroke={highlightStyles.rectStroke}
      stroke-width={highlightStyles.rectStrokeWidth}
      opacity={highlightStyles.opacity}
    />
  {:else}
    <line
      x1={x}
      y1={y + itemHeight / 2}
      x2={x + iconWidth}
      y2={y + itemHeight / 2}
      stroke={color}
      stroke-width={highlightStyles.lineStrokeWidth}
      stroke-dasharray={highlightStyles.lineDasharray}
      stroke-linecap={highlightStyles.lineStrokeLinecap}
      opacity={highlightStyles.opacity}
      class={identifier}
    />
  {/if}

  <g opacity={highlightStyles.opacity}>
    <SvgText
      text={truncateText(name)}
      x={x + iconWidth + textPadding}
      y={y + itemHeight - 4}
      fontSize="12px"
      fontWeight={highlightStyles.textWeight}
    />
  </g>
</g>

<style>
  .legend-item {
    cursor: pointer;
  }

  .legend-item:hover .legend-item-bg {
    fill: rgba(0, 0, 0, 0.05);
  }

  .highlighted .legend-item-bg {
    fill: rgba(0, 0, 0, 0.05);
  }
</style>
