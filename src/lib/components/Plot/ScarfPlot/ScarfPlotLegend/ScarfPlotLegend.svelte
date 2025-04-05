<script lang="ts">
  import type { StylingScarfFillingType } from '$lib/type/Filling/ScarfFilling/index'
  import LegendGroup from './LegendGroup.svelte'

  interface Props {
    filling: StylingScarfFillingType
    onlegendIdentifier: (identifier: string) => void
    availableWidth?: number
    fixedItemWidth?: number
    itemsPerRow?: number
    x?: number
    y?: number
    highlightedIdentifier?: string | null
  }

  let {
    filling,
    onlegendIdentifier,
    availableWidth = 0,
    fixedItemWidth = 100,
    itemsPerRow = 0,
    x = 0,
    y = 0,
    highlightedIdentifier = null,
  }: Props = $props()

  // Constants for SVG layout
  const LAYOUT = {
    TITLE_HEIGHT: 18, // Matches LEGEND_CONFIG.TITLE_HEIGHT in ScarfPlotFigure
    ITEM_HEIGHT: 15, // Matches LAYOUT.LEGEND_ITEM_HEIGHT in ScarfPlotFigure
    ITEM_PADDING: 8, // Vertical padding between items
    GROUP_SPACING: 16, // Spacing between groups
    ICON_WIDTH: 20,
    TEXT_PADDING: 8,
    ITEM_SPACING: 8, // Horizontal spacing between items
  }

  // Dynamically calculate items per row - either use provided value or calculate based on available width
  const calculateItemsPerRow = $derived.by(() => {
    if (itemsPerRow > 0) {
      return itemsPerRow
    }

    if (!availableWidth || availableWidth <= 0) {
      return 3 // Default if no width provided
    }

    // Calculate how many items can fit in the available width with 8px spacing
    const itemFullWidth = fixedItemWidth + LAYOUT.ITEM_SPACING
    const maxItems = Math.floor(availableWidth / itemFullWidth)

    // Return at least 1 item per row, or as many as will fit
    return Math.max(1, maxItems)
  })

  // Use constant 8px spacing between items
  const itemSpacing = $derived.by(() => {
    return LAYOUT.ITEM_SPACING
  })

  // Calculate rows needed for each group
  const aoiRows = $derived(Math.ceil(filling.aoi.length / calculateItemsPerRow))
  const categoryRows = $derived(
    Math.ceil(filling.category.length / calculateItemsPerRow)
  )
  const visibilityRows = $derived(
    filling.visibility.length > 0
      ? Math.ceil(filling.visibility.length / calculateItemsPerRow)
      : 0
  )

  // Calculate height for each group
  const aoiHeight = $derived(
    LAYOUT.TITLE_HEIGHT + aoiRows * (LAYOUT.ITEM_HEIGHT + LAYOUT.ITEM_PADDING)
  )

  const categoryHeight = $derived(
    LAYOUT.TITLE_HEIGHT +
      categoryRows * (LAYOUT.ITEM_HEIGHT + LAYOUT.ITEM_PADDING)
  )

  const visibilityHeight = $derived(
    filling.visibility.length > 0
      ? LAYOUT.TITLE_HEIGHT +
          visibilityRows * (LAYOUT.ITEM_HEIGHT + LAYOUT.ITEM_PADDING)
      : 0
  )

  // Calculate total legend height
  const getLegendHeight = $derived(
    aoiHeight +
      categoryHeight +
      visibilityHeight +
      LAYOUT.GROUP_SPACING * (filling.visibility.length > 0 ? 2 : 1)
  )

  // Calculate total legend width
  const getLegendWidth = $derived.by(() => {
    // Always use the full available width
    return availableWidth > 0 ? availableWidth : fixedItemWidth
  })

  // Calculate Y position for groups
  const categoryY = $derived(aoiHeight + LAYOUT.GROUP_SPACING)
  const visibilityY = $derived(
    categoryY + categoryHeight + LAYOUT.GROUP_SPACING
  )
</script>

<svg
  class="scarf-plot-legend"
  width={getLegendWidth}
  height={getLegendHeight}
  {x}
  {y}
>
  <!-- Fixations Group -->
  <LegendGroup
    title="Fixations"
    items={filling.aoi}
    x={0}
    y={0}
    itemsPerRow={calculateItemsPerRow}
    {fixedItemWidth}
    {itemSpacing}
    titleHeight={LAYOUT.TITLE_HEIGHT}
    itemHeight={LAYOUT.ITEM_HEIGHT}
    itemPadding={LAYOUT.ITEM_PADDING}
    iconWidth={LAYOUT.ICON_WIDTH}
    textPadding={LAYOUT.TEXT_PADDING}
    type="rect"
    onItemClick={onlegendIdentifier}
    {highlightedIdentifier}
  />

  <!-- Non-fixations Group -->
  <LegendGroup
    title="Non-fixations"
    items={filling.category}
    x={0}
    y={categoryY}
    itemsPerRow={calculateItemsPerRow}
    {fixedItemWidth}
    {itemSpacing}
    titleHeight={LAYOUT.TITLE_HEIGHT}
    itemHeight={LAYOUT.ITEM_HEIGHT}
    itemPadding={LAYOUT.ITEM_PADDING}
    iconWidth={LAYOUT.ICON_WIDTH}
    textPadding={LAYOUT.TEXT_PADDING}
    type="rect"
    onItemClick={onlegendIdentifier}
    {highlightedIdentifier}
  />

  <!-- AOI Visibility Group - Only shown if there are visibility items -->
  {#if filling.visibility.length > 0}
    <LegendGroup
      title="AOI Visibility"
      items={filling.visibility}
      x={0}
      y={visibilityY}
      itemsPerRow={calculateItemsPerRow}
      {fixedItemWidth}
      {itemSpacing}
      titleHeight={LAYOUT.TITLE_HEIGHT}
      itemHeight={LAYOUT.ITEM_HEIGHT}
      itemPadding={LAYOUT.ITEM_PADDING}
      iconWidth={LAYOUT.ICON_WIDTH}
      textPadding={LAYOUT.TEXT_PADDING}
      type="line"
      onItemClick={onlegendIdentifier}
      {highlightedIdentifier}
    />
  {/if}
</svg>

<style>
  .scarf-plot-legend {
    font-family: sans-serif;
    overflow: visible;
  }
</style>
