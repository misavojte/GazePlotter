<script lang="ts">
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import type { ScarfFillingType } from '$lib/plots/scarf/types'
  import { transformDataToScarfPlot, ScarfPlotFigure } from '$lib/plots'
  import GeneralCanvasPreview from '$lib/modals/shared/components/CanvasPreview.svelte'
  import { getParticipants } from '$lib/gaze-data/front-process/stores/dataStore'
  import { untrack } from 'svelte'
  import { SectionHeader, DownloadPlotSettings } from '$lib/modals'

  interface Props {
    settings: ScarfGridType
    data: ScarfFillingType
  }

  let { settings }: Props = $props()

  const obtainedData = transformDataToScarfPlot(
    untrack(() => settings.stimulusId),
    untrack(() =>
      getParticipants(settings.groupId, settings.stimulusId).map(
        participant => participant.id
      )
    ),
    untrack(() => settings)
  )

  // Export settings state
  let typeOfExport = $state<'.png' | '.jpg'>('.png')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-ScarfPlot')
  let dpi = $state(96) /* standard web DPI */
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

  // Calculate the effective width (what will be available for the chart after margins)
  const effectiveWidth = $derived(width - (marginLeft + marginRight))

  // Calculate the total height
  const totalHeight = obtainedData.chartHeight + 130

  // Calculate heights for ScarfPlotFigure
  const calculatedHeights = $derived({
    participantBarHeight: obtainedData.heightOfBarWrap,
    heightOfParticipantBars:
      obtainedData.participants.length * obtainedData.heightOfBarWrap,
    chartHeight: obtainedData.chartHeight,
    // Calculate a reasonable legend height
    legendHeight: obtainedData.stylingAndLegend
      ? Math.max(
          50,
          ((obtainedData.stylingAndLegend.aoi.length +
            obtainedData.stylingAndLegend.category.length +
            obtainedData.stylingAndLegend.visibility.length) *
            30) /
            3
        )
      : 50,
    totalHeight: totalHeight,
    axisLabelY:
      obtainedData.participants.length * obtainedData.heightOfBarWrap + 40,
    legendY:
      obtainedData.participants.length * obtainedData.heightOfBarWrap + 80,
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
  />

  <!-- Preview Section -->
  <div class="preview-section">
    <SectionHeader text="Your exported plot" />
    <div>
      <GeneralCanvasPreview
        {fileName}
        fileType={typeOfExport}
        showDownloadButton={true}
      >
        <ScarfPlotFigure
          dpiOverride={dpi}
          {marginTop}
          {marginRight}
          {marginBottom}
          {marginLeft}
          data={obtainedData}
          {settings}
          chartWidth={effectiveWidth}
          {calculatedHeights}
          highlightedIdentifier={null}
          tooltipAreaElement={null}
          onLegendClick={() => {}}
          onTooltipActivation={() => {}}
          onTooltipDeactivation={() => {}}
        />
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

  .preview-section {
    flex-grow: 1;
  }
</style>
