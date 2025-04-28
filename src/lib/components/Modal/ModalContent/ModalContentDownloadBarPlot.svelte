<script lang="ts">
  import DownloadPlotSettings from '$lib/components/Modal/Shared/DownloadPlotSettings.svelte'
  import type { BarPlotGridType } from '$lib/type/gridType'
  import BarPlotFigure from '$lib/plots/bar/components/BarPlotFigure.svelte'
  import { getBarPlotData } from '$lib/plots/bar/utils/barPlotUtils'
  import GeneralCanvasPreview from '$lib/components/General/GeneralCanvasPreview/GeneralCanvasPreview.svelte'
  import SectionHeader from '$lib/components/Modal/Shared/SectionHeader.svelte'

  interface Props {
    settings: BarPlotGridType
  }

  let { settings }: Props = $props()

  // Export settings state
  let typeOfExport = $state<'.png' | '.jpg'>('.png')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-BarPlot')
  let dpi = $state(96) /* standard web DPI */
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

  // Calculate the effective dimensions
  const effectiveWidth = $derived(width - (marginLeft + marginRight))
  const effectiveHeight = $derived(width * 0.6 - (marginTop + marginBottom)) // Using a 5:3 aspect ratio

  // Get bar plot data and prepare props for the figure
  const { data, timeline } = getBarPlotData(settings)

  // Props to pass to the BarPlotFigure component
  const barPlotProps = $derived({
    width: effectiveWidth,
    height: effectiveHeight,
    data,
    timeline,
    barPlottingType: settings.barPlottingType,
    barWidth: 200,
    barSpacing: 20,
    onDataHover: () => {},
    dpiOverride: dpi,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
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
        <BarPlotFigure {...barPlotProps} />
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
