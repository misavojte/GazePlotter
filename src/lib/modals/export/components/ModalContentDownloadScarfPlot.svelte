<script lang="ts">
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import type { ScarfData } from '$lib/plots/scarf/types'
  import {
    transformDataToScarfPlot,
    ScarfPlotFigure,
    SCARF_LAYOUT,
  } from '$lib/plots'
  import GeneralCanvasPreview from '$lib/modals/shared/components/CanvasPreview.svelte'
  import { getParticipants, engine } from '$lib/gaze-data/front-process'
  import { untrack } from 'svelte'
  import { SectionHeader, DownloadPlotSettings } from '$lib/modals'

  interface Props {
    settings: ScarfGridType
    data: ScarfData
  }

  let { settings }: Props = $props()

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

  const obtainedData = $derived.by(() => {
    const meta = engine.metadata
    if (!meta) throw new Error('Data engine metadata not available')

    return transformDataToScarfPlot(
      untrack(() => settings.stimulusId),
      untrack(() =>
        getParticipants(settings.groupId, settings.stimulusId).map(
          participant => participant.id
        )
      ),
      untrack(() => settings),
      meta.noAoiTreatment
    )
  })

  // Calculate the total height
  const totalHeight = $derived((obtainedData?.chartHeight ?? 0) + 130)
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
        {#if obtainedData}
          {@const data = obtainedData}
          <ScarfPlotFigure
            dpiOverride={dpi}
            {marginTop}
            {marginRight}
            {marginBottom}
            {marginLeft}
            {data}
            {settings}
            chartWidth={effectiveWidth}
            availableHeight={totalHeight}
            highlights={settings.highlights ?? []}
            tooltipAreaElement={null}
            onLegendClick={() => {}}
            onTooltipActivation={() => {}}
            onTooltipDeactivation={() => {}}
          />
        {/if}
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
