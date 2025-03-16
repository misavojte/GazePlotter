<script lang="ts">
  let {
    width = 500,
    y = 0,
    height = 40,
    colorScale = ['#f7fbff', '#08306b'],
    maxValue = 100,
    title = 'Transition Count',
  } = $props<{
    width: number
    y: number
    height: number
    colorScale?: string[]
    maxValue: number
    title?: string
  }>()

  // Simple color interpolation function (same as in the main component)
  function interpolateColor(
    color1: string,
    color2: string,
    factor: number
  ): string {
    // Parse hex colors
    const r1 = parseInt(color1.slice(1, 3), 16)
    const g1 = parseInt(color1.slice(3, 5), 16)
    const b1 = parseInt(color1.slice(5, 7), 16)

    const r2 = parseInt(color2.slice(1, 3), 16)
    const g2 = parseInt(color2.slice(3, 5), 16)
    const b2 = parseInt(color2.slice(5, 7), 16)

    // Interpolate
    const r = Math.round(r1 + factor * (r2 - r1))
    const g = Math.round(g1 + factor * (g2 - g1))
    const b = Math.round(b1 + factor * (b2 - b1))

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Constants for legend
  const LEGEND_MARGIN = 50
  const LEGEND_HEIGHT = 15
  const LEGEND_WIDTH = width - 2 * LEGEND_MARGIN
  const STEPS = 100 // Number of gradient steps
</script>

<svg x={0} {y} {width} {height}>
  <!-- Title -->
  <text
    x={width / 2}
    y={10}
    text-anchor="middle"
    dominant-baseline="middle"
    font-size="12px"
  >
    {title}
  </text>

  <!-- Color gradient -->
  {#each Array(STEPS) as _, i}
    <rect
      x={LEGEND_MARGIN + (i * LEGEND_WIDTH) / STEPS}
      y={20}
      width={LEGEND_WIDTH / STEPS + 1}
      height={LEGEND_HEIGHT}
      fill={interpolateColor(colorScale[0], colorScale[1], i / STEPS)}
    />
  {/each}

  <!-- Border around gradient -->
  <rect
    x={LEGEND_MARGIN}
    y={20}
    width={LEGEND_WIDTH}
    height={LEGEND_HEIGHT}
    fill="none"
    stroke="#666"
    stroke-width="1"
  />

  <!-- Min and max labels -->
  <text
    x={LEGEND_MARGIN}
    y={20 + LEGEND_HEIGHT + 12}
    text-anchor="middle"
    font-size="10"
  >
    0
  </text>

  <text
    x={LEGEND_MARGIN + LEGEND_WIDTH}
    y={20 + LEGEND_HEIGHT + 12}
    text-anchor="middle"
    font-size="10"
  >
    {maxValue}
  </text>
</svg>
