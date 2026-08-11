<script lang="ts">
  import { getGazePlotterSession } from '$lib/session'
  import type { AllGridTypes } from '$lib/workspace/grid'
  import { deriveItemView, itemExportProps } from './view'

  /**
   * Fit-to-box live preview of one figure exactly as it will export: the
   * figure's workspace-derived size with the export margin carved out, on a
   * white background. Rendered at device pixel ratio (DPI only scales output
   * pixel density, not layout, so this preview is layout-faithful) and
   * CSS-scaled down to fit. The caption states the real output size — pixels
   * and physical print size at the chosen resolution.
   */
  interface Props {
    item: AllGridTypes
    dpi: number
    margin: number
  }

  let { item, dpi, margin }: Props = $props()
  const { engine, grid } = getGazePlotterSession()

  const view = $derived(deriveItemView(engine, item))
  const exportProps = $derived(itemExportProps(item, grid, null, margin))
  const Figure = $derived(view?.component)

  const MAX_PREVIEW_HEIGHT = 380

  let frameWidth = $state(0)
  const scale = $derived(
    Math.min(
      1,
      frameWidth > 0 ? frameWidth / exportProps.width : 1,
      MAX_PREVIEW_HEIGHT / exportProps.height
    )
  )

  const outputWidth = $derived(Math.round(exportProps.width * (dpi / 96)))
  const outputHeight = $derived(Math.round(exportProps.height * (dpi / 96)))
  const toCm = (px: number) => ((px / dpi) * 2.54).toFixed(1)
</script>

<div class="preview-frame">
  <!-- Unpadded measure target: clientWidth on the padded frame would include
       the padding and let the scaled figure overflow into it. -->
  <div class="preview-measure" bind:clientWidth={frameWidth}>
    {#if view && Figure}
      {#if frameWidth > 0}
        <div
          class="stage"
          style="width: {exportProps.width * scale}px; height: {exportProps.height *
            scale}px"
        >
          <div
            class="figure"
            style="width: {exportProps.width}px; height: {exportProps.height}px; transform: scale({scale})"
          >
            <svelte:boundary>
              <Figure
                {...view.props}
                width={exportProps.width}
                height={exportProps.height}
                margin={exportProps.margin}
              />
              {#snippet failed()}
                <p class="preview-message">
                  Preview could not be generated for this figure.
                </p>
              {/snippet}
            </svelte:boundary>
          </div>
        </div>
      {/if}
    {:else}
      <p class="preview-message">
        This figure has nothing to draw with its current settings.
      </p>
    {/if}
  </div>
</div>
{#if view}
  <p class="caption">
    {outputWidth} × {outputHeight} px · {toCm(outputWidth)} × {toCm(
      outputHeight
    )} cm at {dpi} DPI
  </p>
{/if}

<style>
  .preview-frame {
    padding: 1rem;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    background-color: var(--c-darkwhite);
    overflow: hidden;
  }

  .preview-measure {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .stage {
    background-color: white;
    box-shadow: var(--shadow);
  }

  .figure {
    transform-origin: top left;
    background-color: white;
    pointer-events: none;
  }

  .preview-message {
    margin: 2rem 0;
    color: var(--c-midgrey);
    font-size: 0.85rem;
    font-style: italic;
    text-align: center;
  }

  .caption {
    margin: 0.35rem 0 0 0;
    font-size: 0.8rem;
    color: var(--c-darkgrey);
    text-align: center;
  }
</style>
