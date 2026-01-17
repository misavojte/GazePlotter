<script lang="ts">
  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
  import AoiStreamPlotFigure from '$lib/plots/aoi-stream/components/AoiStreamPlotFigure.svelte'
  import { getAoiStreamPlotData } from '$lib/plots/aoi-stream/utils'
  import GeneralCanvasPreview from '$lib/modals/shared/components/CanvasPreview.svelte'
  import { SectionHeader, DownloadPlotSettings } from '$lib/modals'

  interface Props {
    settings: AoiStreamPlotGridType
  }

  let { settings }: Props = $props()

  // Export settings state
  let typeOfExport = $state<'.png' | '.jpg'>('.png')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-AoiStreamPlot')
  let dpi = $state(96) /* standard web DPI */
  let marginTop = $state(20) /* in px */
  let marginRight = $state(20) /* in px */
  let marginBottom = $state(20) /* in px */
  let marginLeft = $state(20) /* in px */

  const effectiveWidth = $derived(width - (marginLeft + marginRight))
  const effectiveHeight = $derived(width * 0.6 - (marginTop + marginBottom))

  const streamData = $derived.by(() =>
    getAoiStreamPlotData({
      stimulusId: settings.stimulusId,
      groupId: settings.groupId,
      binCount: settings.binCount,
    })
  )
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
        <AoiStreamPlotFigure
          width={effectiveWidth}
          height={effectiveHeight}
          data={streamData}
          dpiOverride={dpi}
          {marginTop}
          {marginRight}
          {marginBottom}
          {marginLeft}
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
