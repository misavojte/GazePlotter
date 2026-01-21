<script lang="ts">
  import GeneralCanvasPreview from './CanvasPreview.svelte'
  import DownloadPlotSettings from './DownloadPlotSettings.svelte'
  import SectionHeader from './SectionHeader.svelte'
  import type { Snippet } from 'svelte'

  /**
   * Standard export props that plot figures accept.
   * All plot figures should handle margins internally by sizing
   * their canvas to (width + marginLeft + marginRight) x (height + marginTop + marginBottom).
   */
  export interface PlotExportProps {
    /** Content width (excluding margins) - plot figure adds margins to canvas size */
    width: number
    /** Content height (excluding margins) - plot figure adds margins to canvas size */
    height: number
    /** DPI setting for high-resolution export */
    dpiOverride: number
    /** Top margin in pixels */
    marginTop: number
    /** Right margin in pixels */
    marginRight: number
    /** Bottom margin in pixels */
    marginBottom: number
    /** Left margin in pixels */
    marginLeft: number
  }

  /**
   * Configuration for the plot export wrapper.
   */
  interface Props {
    /** Default filename for the export (without extension) */
    defaultFileName: string
    /** Aspect ratio for the plot (height = width * aspectRatio). Default: 0.6 */
    aspectRatio?: number
    /** Default width in pixels. Default: 800 */
    defaultWidth?: number
    /** Default DPI. Default: 96 */
    defaultDpi?: number
    /** Default margin for all sides in pixels. Default: 20 */
    defaultMargin?: number
    /**
     * Snippet that renders the plot figure.
     * Receives PlotExportProps - pass these directly to your plot figure.
     */
    children: Snippet<[PlotExportProps]>
  }

  let {
    defaultFileName,
    aspectRatio = 0.6,
    defaultWidth = 800,
    defaultDpi = 96,
    defaultMargin = 20,
    children,
  }: Props = $props()

  // Capture initial values (intentionally not reactive - these are defaults)
  const initialWidth = defaultWidth
  const initialFileName = defaultFileName
  const initialDpi = defaultDpi
  const initialMargin = defaultMargin

  // Export settings state
  let typeOfExport = $state<'.png' | '.jpg'>('.png')
  let width = $state(initialWidth)
  let fileName = $state(initialFileName)
  let dpi = $state(initialDpi)
  let marginTop = $state(initialMargin)
  let marginRight = $state(initialMargin)
  let marginBottom = $state(initialMargin)
  let marginLeft = $state(initialMargin)

  // Computed content dimensions (what the plot figure receives)
  // Plot figures add margins internally when sizing their canvas
  const contentWidth = $derived(width - marginLeft - marginRight)
  const contentHeight = $derived(width * aspectRatio - marginTop - marginBottom)

  // Props object to pass to child plot figure
  const exportProps: PlotExportProps = $derived({
    width: contentWidth,
    height: contentHeight,
    dpiOverride: dpi,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
  })
</script>

<div class="plot-export-container">
  <!-- Settings Section -->
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
        {@render children(exportProps)}
      </GeneralCanvasPreview>
    </div>
  </div>
</div>

<style>
  .plot-export-container {
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
