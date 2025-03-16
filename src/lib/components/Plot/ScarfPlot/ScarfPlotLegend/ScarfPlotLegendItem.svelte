<script lang="ts">
  import type { SingleStylingScarfFillingType } from '$lib/type/Filling/ScarfFilling/index'

  interface Props {
    legend: SingleStylingScarfFillingType
    isVisibility?: boolean
    onlegendIdentifier?: (event: CustomEvent) => void
  }

  let {
    legend,
    isVisibility = false,
    onlegendIdentifier = () => {},
  }: Props = $props()

  const handleClick = () => {
    onlegendIdentifier(
      new CustomEvent('legendIdentifier', { detail: legend.identifier })
    )
  }

  // display legend name is max 13 characters, if it is longer, it will be cut and '...' will be added
  let displayLegendName =
    legend.name.length > 12 ? legend.name.slice(0, 10) + '...' : legend.name
</script>

<div class="legendItem {legend.identifier}" onclick={handleClick}>
  <svg width="20" height={legend.heighOfLegendItem}>
    {#if isVisibility}
      <line
        class={legend.identifier}
        x1="0"
        x2="100%"
        y1="50%"
        y2="50%"
        stroke={legend.color}
      />
    {:else}
      <rect
        class={legend.identifier}
        width="100%"
        y={legend.heighOfLegendItem / 2 - legend.height / 2}
        height={legend.height}
        fill={legend.color}
      />
    {/if}
  </svg>
  <div>
    {displayLegendName}
  </div>
</div>

<style>
  .legendItem {
    display: flex;
    gap: 8px;
    font-size: 12px;
    align-items: center;
    width: 115px;
    line-height: 1;
    cursor: pointer;
  }
</style>
