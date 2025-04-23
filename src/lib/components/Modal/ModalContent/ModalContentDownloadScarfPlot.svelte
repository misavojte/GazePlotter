<script lang="ts">
  import DownloadPlotSettings from '$lib/components/Modal/Shared/DownloadPlotSettings.svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  import ScarfPlotFigure from '$lib/components/Plot/ScarfPlot/ScarfPlotFigure/ScarfPlotFigure.svelte'
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  import GeneralCanvasPreview from '$lib/components/General/GeneralCanvasPreview/GeneralCanvasPreview.svelte'

  interface Props {
    settings: ScarfGridType
    data: ScarfFillingType
  }

  let { settings, data }: Props = $props()

  // Export settings state
  let typeOfExport = $state<'.png' | '.jpg'>('.png')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-ScarfPlot')
  let dpi = $state(96) /* standard web DPI */
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

  // States for interaction
  let highlightedIdentifier = $state<string | null>(null)
  let tooltipAreaElement = $state<HTMLElement | SVGElement | null>(null)

  // Calculate the effective width (what will be available for the chart after margins)
  const effectiveWidth = $derived(width - (marginLeft + marginRight))

  // Calculate the total height
  const totalHeight = $derived(data.chartHeight + 130)

  // Handlers for ScarfPlotFigure
  const handleLegendClick = (identifier: string) => {
    highlightedIdentifier =
      identifier === highlightedIdentifier ? null : identifier
  }

  const handleTooltipActivation = () => {}
  const handleTooltipDeactivation = () => {}

  // Calculate heights for ScarfPlotFigure
  const calculatedHeights = $derived({
    participantBarHeight: data.heightOfBarWrap,
    heightOfParticipantBars: data.participants.length * data.heightOfBarWrap,
    chartHeight: data.chartHeight,
    // Calculate a reasonable legend height
    legendHeight: data.stylingAndLegend
      ? Math.max(
          50,
          ((data.stylingAndLegend.aoi.length +
            data.stylingAndLegend.category.length +
            data.stylingAndLegend.visibility.length) *
            30) /
            3
        )
      : 50,
    totalHeight: totalHeight,
    axisLabelY: data.participants.length * data.heightOfBarWrap + 40,
    legendY: data.participants.length * data.heightOfBarWrap + 80,
  })

  // Props to pass to the ScarfPlotFigure component
  const scarfPlotProps = $derived({
    data,
    settings,
    highlightedIdentifier,
    tooltipAreaElement,
    onLegendClick: handleLegendClick,
    onTooltipActivation: handleTooltipActivation,
    onTooltipDeactivation: handleTooltipDeactivation,
    chartWidth: effectiveWidth,
    calculatedHeights,
    dpiOverride: dpi,
  })
</script>

<div class="single-view-container">
  <!-- Settings Section using shared component -->
  <DownloadPlotSettings
    bind:typeOfExport
    bind:width
    bind:fileName
    bind:dpi
    bind:marginTop
    bind:marginRight
    bind:marginBottom
    bind:marginLeft
    allowNegativeMargins={true}
  />

  <!-- Preview Section -->
  <div class="preview-section">
    <div class="preview-heading">
      <h3>Your exported plot</h3>
    </div>
    <div>
      <GeneralCanvasPreview
        {fileName}
        fileType={typeOfExport}
        {width}
        height={totalHeight + marginTop + marginBottom}
        {marginTop}
        {marginRight}
        {marginBottom}
        {marginLeft}
        {dpi}
        showDownloadButton={true}
      >
        <ScarfPlotFigure {...scarfPlotProps} />
      </GeneralCanvasPreview>
    </div>
  </div>
</div>

<style>
  .single-view-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-height: 80vh;
    max-width: 830px;
  }

  .preview-heading h3 {
    margin-top: 0;
    margin-bottom: 0.75rem;
    font-weight: 600;
  }

  .preview-section {
    flex-grow: 1;
  }
</style>
