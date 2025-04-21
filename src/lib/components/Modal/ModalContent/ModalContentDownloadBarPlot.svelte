<script lang="ts">
  import DownloadPlotSettings from '$lib/components/Modal/Shared/DownloadPlotSettings.svelte'
  import type { BarPlotGridType } from '$lib/type/gridType'
  import BarPlotFigure from '$lib/components/Plot/BarPlot/BarPlotFigure.svelte'
  import GeneralSvgPreview from '$lib/components/General/GeneralSvgPreview/GeneralSvgPreview.svelte'
  import { getBarPlotData } from '$lib/utils/barPlotUtils'

  interface Props {
    settings: BarPlotGridType
  }

  let { settings }: Props = $props()

  // Export settings state
  let typeOfExport = $state<'.svg' | '.png' | '.jpg' | '.webp'>('.svg')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-BarPlot')
  let dpi = $state(96) /* standard web DPI */
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

  // Calculate the effective dimensions
  const effectiveWidth = $derived(width)
  const effectiveHeight = $derived(width * 0.6) // Using a 5:3 aspect ratio

  // Get bar plot data and prepare props for the figure
  const { data, timeline } = getBarPlotData(settings)

  // Props to pass to the BarPlotFigure component
  const barPlotProps = $derived({
    width: effectiveWidth - (marginLeft + marginRight),
    height: effectiveHeight - (marginTop + marginBottom),
    data,
    timeline,
    barPlottingType: settings.barPlottingType,
    barWidth: 200,
    barSpacing: 20,
    onDataHover: () => {},
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
    <div class="preview-heading">
      <h3>Your exported plot</h3>
    </div>
    <div>
      <GeneralSvgPreview
        {fileName}
        fileType={typeOfExport}
        {width}
        height={effectiveHeight}
        {marginTop}
        {marginRight}
        {marginBottom}
        {marginLeft}
        {dpi}
        showDownloadButton={true}
      >
        <BarPlotFigure {...barPlotProps} />
      </GeneralSvgPreview>
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
    height: auto;
  }
</style>
