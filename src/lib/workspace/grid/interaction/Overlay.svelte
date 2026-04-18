<script lang="ts">
  import { gridToPixelDimensions, gridToPixelPosition } from '../pixels'
  import type { GridConfig } from '../types'
  import type { GridInteractionRect } from './model'

  interface Props {
    preview: GridInteractionRect | null
    gridConfig: GridConfig
    mode: 'moving' | 'resizing' | 'idle' | 'panning'
  }

  const { preview, gridConfig, mode }: Props = $props()

  const overlayStyle = $derived.by(() => {
    if (!preview) return ''

    const position = gridToPixelPosition(preview.x, preview.y, gridConfig)
    const size = gridToPixelDimensions(preview.w, preview.h, gridConfig)

    return `
      transform: translate(${position.left}px, ${position.top}px);
      width: ${size.width}px;
      height: ${size.height}px;
    `
  })
</script>

{#if preview}
  <div
    class="grid-interaction-overlay"
    class:moving={mode === 'moving'}
    class:resizing={mode === 'resizing'}
    style={overlayStyle}
    aria-hidden="true"
  ></div>
{/if}

<style>
  .grid-interaction-overlay {
    position: absolute;
    z-index: 50;
    pointer-events: none;
    opacity: 0.55;
    border: 2px dashed var(--c-text);
    border-radius: var(--rounded-lg, 8px) var(--rounded-lg, 8px) 0
      var(--rounded-lg, 8px);
    background: var(--c-lightgrey);
    box-sizing: border-box;
  }

  .grid-interaction-overlay.moving,
  .grid-interaction-overlay.resizing {
    background: rgba(var(--c-main-rgb, 0, 0, 0), 0.05);
    border-color: var(--c-main);
  }
</style>
