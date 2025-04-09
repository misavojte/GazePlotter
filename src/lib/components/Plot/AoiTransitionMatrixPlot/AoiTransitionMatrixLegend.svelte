<script lang="ts">
  import SvgText from '$lib/components/Plot/SvgText.svelte'
  import GradientRangeSlider from './GradientRangeSlider.svelte'

  let {
    width = 500,
    y = 0,
    x = 0,
    height = 80,
    colorScale = ['#f7fbff', '#08306b'],
    maxValue = 100,
    minValue = 0,
    title = 'Transition Count',
    onColorValueRangeChange,
  } = $props<{
    width: number
    y: number
    x?: number
    height: number
    colorScale?: string[]
    maxValue: number
    minValue: number
    title?: string
    onColorValueRangeChange?: (colorValueRange: [number, number]) => void
  }>()

  // Ensure maxValue is always a whole number (rounded up)
  maxValue = Math.ceil(maxValue)

  let minThreshold = $derived(minValue)
  let maxThreshold = $derived(maxValue)

  function handleMinChange(newMin: number) {
    minThreshold = newMin
    onColorValueRangeChange?.([minThreshold, maxThreshold])
  }

  function handleMaxChange(newMax: number) {
    maxThreshold = newMax
    onColorValueRangeChange?.([minThreshold, maxThreshold])
  }
</script>

<svg
  {x}
  {y}
  {width}
  {height}
  overflow="visible"
  viewBox={`0 0 ${width} ${height}`}
  preserveAspectRatio="none"
  aria-label="Range slider for filtering values"
>
  <SvgText
    text={title}
    x={width / 2}
    y={10}
    textAnchor="middle"
    dominantBaseline="middle"
    fontSize="12"
  />

  <GradientRangeSlider
    {width}
    {colorScale}
    {maxValue}
    y={20}
    minValue={0}
    currentMin={minThreshold}
    currentMax={maxThreshold}
    onMinValueChange={handleMinChange}
    onMaxValueChange={handleMaxChange}
  />
</svg>
