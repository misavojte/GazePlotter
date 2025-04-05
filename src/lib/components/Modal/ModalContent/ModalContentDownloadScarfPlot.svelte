<script lang="ts">
  import GeneralInputNumber from '../../General/GeneralInput/GeneralInputNumber.svelte'
  import GeneralSelectBase from '../../General/GeneralSelect/GeneralSelect.svelte'
  import GeneralInputText from '../../General/GeneralInput/GeneralInputText.svelte'
  import MajorButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  import ScarfPlotFigure from '$lib/components/Plot/ScarfPlot/ScarfPlotFigure/ScarfPlotFigure.svelte'
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  import GeneralSvgPreview from '../../General/GeneralSvgPreview/GeneralSvgPreview.svelte'

  interface Props {
    settings: ScarfGridType
    data: ScarfFillingType
  }

  let { settings, data }: Props = $props()

  type fileType = '.svg' | '.png' | '.jpg' | '.webp'

  let typeOfExport = $state<fileType>('.svg')
  let width = $state(800) /* in px */
  let fileName = $state('GazePlotter-ScarfPlot')

  // States for preview
  let showPreview = $state(false)
  let previewHeight = $state(0)
  let highlightedIdentifier = $state<string | null>(null)
  let tooltipAreaElement = $state<HTMLElement | SVGElement | null>(null)

  const options = [
    { value: '.svg', label: 'SVG (recommended)' },
    { value: '.png', label: 'PNG' },
    { value: '.jpg', label: 'JPG' },
    { value: '.webp', label: 'WEBP' },
  ]

  // Calculate preview height when showing preview
  $effect(() => {
    if (showPreview) {
      // Calculate appropriate height based on data and width
      const aspectRatio = data.chartHeight / width
      previewHeight = Math.round(width * aspectRatio) + 150 // Add extra space for legend and labels
    }
  })

  const handlePreview = () => {
    showPreview = true
  }

  const handleBackToSettings = () => {
    showPreview = false
  }

  // Handlers for ScarfPlotFigure
  const handleLegendClick = (identifier: string) => {
    highlightedIdentifier =
      identifier === highlightedIdentifier ? null : identifier
  }

  const handleTooltipActivation = () => {}
  const handleTooltipDeactivation = () => {}

  // Props to pass to the ScarfPlotFigure component
  const scarfPlotProps = $derived({
    data,
    settings,
    highlightedIdentifier,
    tooltipAreaElement,
    onLegendClick: handleLegendClick,
    onTooltipActivation: handleTooltipActivation,
    onTooltipDeactivation: handleTooltipDeactivation,
    chartWidth: width,
  })
</script>

{#if !showPreview}
  <!-- Settings Screen -->
  <div class="settings-container">
    <GeneralInputNumber label="Width in px" bind:value={width} />
    <GeneralSelectBase
      label="Output file type"
      {options}
      bind:value={typeOfExport}
    />
    <GeneralInputText label="Output file name" bind:value={fileName} />
    <MajorButton onclick={handlePreview}>Preview</MajorButton>
  </div>
{:else}
  <!-- Preview Screen using the reusable component with children prop -->
  <GeneralSvgPreview
    {fileName}
    fileType={typeOfExport}
    {width}
    height={previewHeight}
    onBack={handleBackToSettings}
    children={ScarfPlotFigure}
    childProps={scarfPlotProps}
  />
{/if}

<style>
  .settings-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
