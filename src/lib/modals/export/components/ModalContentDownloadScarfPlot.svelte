<script lang="ts">
  import type { ScarfPlotItem } from '$lib/plots/scarf/types'
  import { transformDataToScarfPlot, ScarfPlotFigure } from '$lib/plots'
  import GeneralCanvasPreview from '$lib/modals/shared/components/CanvasPreview.svelte'
  import { getParticipants } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import type { BaseInterpretedDataType } from '$lib/data/types'
  import { untrack } from 'svelte'
  import { SectionHeader, DownloadPlotSettings } from '$lib/modals'

  interface Props {
    item: ScarfPlotItem
  }

  let { item }: Props = $props()
  const { engine } = getGazePlotterSession()
  const settings = $derived(item.settings)

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
      engine,
      untrack(() => settings.stimulusId),
      untrack(() =>
        getParticipants(engine, settings.groupId, settings.stimulusId).map(
          (participant: BaseInterpretedDataType) => participant.id
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
